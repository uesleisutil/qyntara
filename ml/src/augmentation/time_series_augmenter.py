"""
Time Series Augmenter

Augments time series data using jittering and window slicing.
Validates statistical properties preservation.

Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class TimeSeriesAugmenter:
    """
    Augments time series data for training.
    
    Applies jittering and window slicing to increase dataset size
    while preserving statistical properties.
    """
    
    def __init__(
        self,
        min_observations: int = 500,
        jitter_noise_level: float = 0.05,
        window_overlap: float = 0.80,
        max_augmentation_factor: float = 2.0
    ):
        """
        Initialize time series augmenter.
        
        Args:
            min_observations: Minimum observations before augmentation
            jitter_noise_level: Noise level for jittering (as fraction)
            window_overlap: Overlap fraction for window slicing
            max_augmentation_factor: Maximum size increase (2.0 = 2x original)
        """
        self.min_observations = min_observations
        self.jitter_noise_level = jitter_noise_level
        self.window_overlap = window_overlap
        self.max_augmentation_factor = max_augmentation_factor
    
    def should_augment(self, data: pd.DataFrame) -> bool:
        """
        Check if data should be augmented.
        
        Args:
            data: Time series data
            
        Returns:
            True if data has fewer than min_observations
        """
        return len(data) < self.min_observations
    
    def apply_jittering(
        self,
        data: pd.DataFrame,
        numeric_columns: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Apply jittering (adding small random noise) to data.
        
        Args:
            data: Original time series data
            numeric_columns: Columns to apply jittering to
            
        Returns:
            Jittered data
        """
        jittered = data.copy()
        
        # Determine numeric columns if not specified
        if numeric_columns is None:
            numeric_columns = data.select_dtypes(include=[np.number]).columns.tolist()
        
        # Apply jittering to each numeric column
        for col in numeric_columns:
            if col in jittered.columns:
                # Calculate noise based on column std
                col_std = jittered[col].std()
                noise = np.random.normal(
                    0,
                    col_std * self.jitter_noise_level,
                    size=len(jittered)
                )
                jittered[col] = jittered[col] + noise
        
        return jittered
    
    def apply_window_slicing(
        self,
        data: pd.DataFrame,
        window_size: Optional[int] = None
    ) -> List[pd.DataFrame]:
        """
        Apply window slicing with overlap to create multiple samples.
        
        Args:
            data: Original time series data
            window_size: Size of sliding window (default: 80% of data length)
            
        Returns:
            List of windowed DataFrames
        """
        if window_size is None:
            window_size = int(len(data) * 0.8)
        
        # Calculate step size based on overlap
        step_size = int(window_size * (1 - self.window_overlap))
        
        if step_size == 0:
            step_size = 1
        
        windows = []
        
        # Create sliding windows
        for start_idx in range(0, len(data) - window_size + 1, step_size):
            end_idx = start_idx + window_size
            window = data.iloc[start_idx:end_idx].copy()
            windows.append(window)
        
        return windows
    
    def calculate_statistical_properties(
        self,
        data: pd.DataFrame,
        numeric_columns: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate statistical properties of data.
        
        Args:
            data: Time series data
            numeric_columns: Columns to analyze
            
        Returns:
            Dictionary of statistical properties per column
        """
        if numeric_columns is None:
            numeric_columns = data.select_dtypes(include=[np.number]).columns.tolist()
        
        properties = {}
        
        for col in numeric_columns:
            if col in data.columns:
                col_data = data[col].dropna()
                
                if len(col_data) > 0:
                    properties[col] = {
                        'mean': float(col_data.mean()),
                        'std': float(col_data.std()),
                        'min': float(col_data.min()),
                        'max': float(col_data.max()),
                        'median': float(col_data.median()),
                        'skewness': float(stats.skew(col_data)),
                        'kurtosis': float(stats.kurtosis(col_data))
                    }
        
        return properties
    
    def validate_statistical_preservation(
        self,
        original_properties: Dict[str, Dict[str, float]],
        augmented_properties: Dict[str, Dict[str, float]],
        tolerance: float = 0.15
    ) -> Tuple[bool, Dict[str, Dict[str, float]]]:
        """
        Validate that augmented data preserves statistical properties.
        
        Args:
            original_properties: Properties of original data
            augmented_properties: Properties of augmented data
            tolerance: Acceptable relative difference (15%)
            
        Returns:
            Tuple of (is_valid, differences)
        """
        differences = {}
        is_valid = True
        
        for col in original_properties.keys():
            if col not in augmented_properties:
                continue
            
            col_diffs = {}
            
            for prop in ['mean', 'std', 'median']:
                orig_value = original_properties[col][prop]
                aug_value = augmented_properties[col][prop]
                
                # Calculate relative difference
                if orig_value != 0:
                    rel_diff = abs(aug_value - orig_value) / abs(orig_value)
                else:
                    rel_diff = abs(aug_value - orig_value)
                
                col_diffs[prop] = rel_diff
                
                # Check if within tolerance
                if rel_diff > tolerance:
                    is_valid = False
                    logger.warning(
                        f"Column {col}, property {prop}: "
                        f"relative difference {rel_diff:.3f} exceeds tolerance {tolerance}"
                    )
            
            differences[col] = col_diffs
        
        return is_valid, differences
    
    def augment(
        self,
        data: pd.DataFrame,
        numeric_columns: Optional[List[str]] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Augment time series data.
        
        Args:
            data: Original time series data
            numeric_columns: Columns to augment
            
        Returns:
            Tuple of (augmented_data, augmentation_info)
        """
        logger.info(f"Starting augmentation for dataset with {len(data)} observations")
        
        # Check if augmentation is needed
        if not self.should_augment(data):
            logger.info("Dataset has sufficient observations, skipping augmentation")
            return data, {
                'augmented': False,
                'reason': 'sufficient_observations',
                'original_size': len(data)
            }
        
        # Calculate original statistical properties
        original_properties = self.calculate_statistical_properties(data, numeric_columns)
        
        augmented_samples = [data]
        
        # Calculate how many augmented samples we can create
        max_total_size = int(len(data) * self.max_augmentation_factor)
        remaining_capacity = max_total_size - len(data)
        
        # Apply jittering
        num_jittered = min(
            len(data),
            remaining_capacity // 2
        )
        
        for _ in range(num_jittered // len(data)):
            jittered = self.apply_jittering(data, numeric_columns)
            augmented_samples.append(jittered)
            remaining_capacity -= len(jittered)
        
        # Apply window slicing
        if remaining_capacity > 0:
            windows = self.apply_window_slicing(data)
            
            # Add windows until we reach capacity
            for window in windows:
                if remaining_capacity <= 0:
                    break
                augmented_samples.append(window)
                remaining_capacity -= len(window)
        
        # Combine all augmented samples
        augmented_data = pd.concat(augmented_samples, ignore_index=True)
        
        # Limit to max augmentation factor
        if len(augmented_data) > max_total_size:
            augmented_data = augmented_data.iloc[:max_total_size]
        
        # Calculate augmented statistical properties
        augmented_properties = self.calculate_statistical_properties(
            augmented_data,
            numeric_columns
        )
        
        # Validate statistical preservation
        is_valid, differences = self.validate_statistical_preservation(
            original_properties,
            augmented_properties
        )
        
        augmentation_info = {
            'augmented': True,
            'original_size': len(data),
            'augmented_size': len(augmented_data),
            'augmentation_factor': len(augmented_data) / len(data),
            'num_jittered_samples': num_jittered,
            'num_window_samples': len(augmented_samples) - num_jittered - 1,
            'statistical_properties_preserved': is_valid,
            'property_differences': differences
        }
        
        logger.info(
            f"Augmentation complete: {len(data)} -> {len(augmented_data)} observations "
            f"(factor: {augmentation_info['augmentation_factor']:.2f})"
        )
        
        if not is_valid:
            logger.warning("Statistical properties not fully preserved within tolerance")
        
        return augmented_data, augmentation_info

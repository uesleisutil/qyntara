"""
Data Validator

This module validates data completeness and schema before feature calculation.
Logs validation results for audit purposes.

**Validates: Requirements 11.5**
"""

import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Optional
import json
from datetime import datetime
import logging


class DataValidator:
    """
    Validator for data completeness and schema validation.
    
    Provides functionality to:
    - Validate data completeness before feature calculation
    - Validate schema (column names, data types)
    - Log validation results
    """
    
    def __init__(self, logger: logging.Logger = None):
        """
        Initialize the data validator.
        
        Args:
            logger: Optional logger instance for logging operations
        """
        self.logger = logger or logging.getLogger(__name__)
    
    def validate_completeness(
        self, 
        data: pd.DataFrame, 
        threshold: float = 0.20
    ) -> Tuple[bool, List[str]]:
        """
        Validate data completeness before feature calculation.
        
        Checks if any column has missing data above the threshold.
        
        Args:
            data: DataFrame to validate
            threshold: Maximum allowed missing data percentage (0-1, default: 0.20 = 20%)
            
        Returns:
            Tuple of:
            - Boolean indicating if data is complete enough (True = valid)
            - List of column names that exceed the threshold
        """
        if data.empty:
            self.logger.warning("Empty DataFrame provided for validation")
            return True, []
        
        # Calculate missing percentage per column
        total_rows = len(data)
        missing_counts = data.isna().sum()
        missing_percentages = missing_counts / total_rows
        
        # Find columns exceeding threshold
        invalid_columns = missing_percentages[missing_percentages > threshold].index.tolist()
        
        is_valid = len(invalid_columns) == 0
        
        if not is_valid:
            self.logger.warning(
                f"Data completeness validation failed. "
                f"{len(invalid_columns)} columns exceed {threshold*100}% missing threshold: "
                f"{invalid_columns}"
            )
        else:
            self.logger.info("Data completeness validation passed")
        
        return is_valid, invalid_columns
    
    def validate_schema(
        self, 
        data: pd.DataFrame, 
        expected_columns: List[str],
        strict: bool = False
    ) -> bool:
        """
        Validate that DataFrame has expected columns.
        
        Args:
            data: DataFrame to validate
            expected_columns: List of expected column names
            strict: If True, DataFrame must have exactly these columns.
                   If False, DataFrame must have at least these columns.
            
        Returns:
            Boolean indicating if schema is valid
        """
        if data.empty and len(expected_columns) > 0:
            self.logger.error("Empty DataFrame but expected columns specified")
            return False
        
        actual_columns = set(data.columns)
        expected_columns_set = set(expected_columns)
        
        if strict:
            # Must have exactly these columns
            is_valid = actual_columns == expected_columns_set
            
            if not is_valid:
                missing = expected_columns_set - actual_columns
                extra = actual_columns - expected_columns_set
                
                if missing:
                    self.logger.error(f"Missing required columns: {missing}")
                if extra:
                    self.logger.error(f"Unexpected extra columns: {extra}")
        else:
            # Must have at least these columns
            missing = expected_columns_set - actual_columns
            is_valid = len(missing) == 0
            
            if not is_valid:
                self.logger.error(f"Missing required columns: {missing}")
        
        if is_valid:
            self.logger.info("Schema validation passed")
        
        return is_valid
    
    def validate_data_types(
        self, 
        data: pd.DataFrame, 
        expected_types: Dict[str, type]
    ) -> Tuple[bool, List[str]]:
        """
        Validate that columns have expected data types.
        
        Args:
            data: DataFrame to validate
            expected_types: Dictionary mapping column names to expected types
            
        Returns:
            Tuple of:
            - Boolean indicating if all types are valid
            - List of columns with invalid types
        """
        invalid_columns = []
        
        for col, expected_type in expected_types.items():
            if col not in data.columns:
                self.logger.warning(f"Column '{col}' not found in DataFrame")
                invalid_columns.append(col)
                continue
            
            actual_type = data[col].dtype
            
            # Check if type matches (handle numpy types)
            if expected_type == float:
                is_valid = pd.api.types.is_float_dtype(actual_type) or pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == int:
                is_valid = pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == str:
                is_valid = pd.api.types.is_string_dtype(actual_type) or pd.api.types.is_object_dtype(actual_type)
            elif expected_type == bool:
                is_valid = pd.api.types.is_bool_dtype(actual_type)
            else:
                is_valid = actual_type == expected_type
            
            if not is_valid:
                self.logger.error(
                    f"Column '{col}' has invalid type. "
                    f"Expected: {expected_type}, Actual: {actual_type}"
                )
                invalid_columns.append(col)
        
        is_valid = len(invalid_columns) == 0
        
        if is_valid:
            self.logger.info("Data type validation passed")
        
        return is_valid, invalid_columns
    
    def validate_value_ranges(
        self, 
        data: pd.DataFrame, 
        ranges: Dict[str, Tuple[Optional[float], Optional[float]]]
    ) -> Tuple[bool, Dict[str, List[int]]]:
        """
        Validate that column values are within expected ranges.
        
        Args:
            data: DataFrame to validate
            ranges: Dictionary mapping column names to (min, max) tuples.
                   Use None for unbounded ranges.
            
        Returns:
            Tuple of:
            - Boolean indicating if all values are in range
            - Dictionary mapping column names to lists of invalid row indices
        """
        invalid_rows = {}
        
        for col, (min_val, max_val) in ranges.items():
            if col not in data.columns:
                self.logger.warning(f"Column '{col}' not found in DataFrame")
                continue
            
            # Get non-NaN values
            col_data = data[col].dropna()
            
            if len(col_data) == 0:
                continue
            
            # Check min bound
            if min_val is not None:
                below_min = col_data < min_val
                if below_min.any():
                    invalid_indices = col_data[below_min].index.tolist()
                    invalid_rows[col] = invalid_rows.get(col, []) + invalid_indices
                    self.logger.error(
                        f"Column '{col}' has {below_min.sum()} values below minimum {min_val}"
                    )
            
            # Check max bound
            if max_val is not None:
                above_max = col_data > max_val
                if above_max.any():
                    invalid_indices = col_data[above_max].index.tolist()
                    invalid_rows[col] = invalid_rows.get(col, []) + invalid_indices
                    self.logger.error(
                        f"Column '{col}' has {above_max.sum()} values above maximum {max_val}"
                    )
        
        is_valid = len(invalid_rows) == 0
        
        if is_valid:
            self.logger.info("Value range validation passed")
        
        return is_valid, invalid_rows
    
    def validate_no_duplicates(
        self, 
        data: pd.DataFrame, 
        subset: Optional[List[str]] = None
    ) -> Tuple[bool, pd.DataFrame]:
        """
        Validate that DataFrame has no duplicate rows.
        
        Args:
            data: DataFrame to validate
            subset: Optional list of columns to check for duplicates.
                   If None, checks all columns.
            
        Returns:
            Tuple of:
            - Boolean indicating if no duplicates exist
            - DataFrame containing duplicate rows (if any)
        """
        duplicates = data[data.duplicated(subset=subset, keep=False)]
        
        is_valid = len(duplicates) == 0
        
        if not is_valid:
            self.logger.warning(f"Found {len(duplicates)} duplicate rows")
        else:
            self.logger.info("No duplicate rows found")
        
        return is_valid, duplicates
    
    def log_validation_results(
        self, 
        results: Dict, 
        log_path: str
    ) -> None:
        """
        Log validation results to a file.
        
        Args:
            results: Dictionary containing validation results with keys:
                    - timestamp: Validation timestamp
                    - data_shape: Tuple of (rows, columns)
                    - completeness_valid: Boolean
                    - completeness_invalid_columns: List of column names
                    - schema_valid: Boolean
                    - type_valid: Boolean
                    - type_invalid_columns: List of column names
                    - range_valid: Boolean
                    - range_invalid_rows: Dictionary
                    - duplicates_valid: Boolean
                    - duplicates_count: Integer
            log_path: Path to save the log file (JSON format)
        """
        # Add metadata
        log_data = {
            'log_created_at': datetime.now().isoformat(),
            'validation_results': results
        }
        
        # Write to JSON file
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2, default=str)
        
        self.logger.info(f"Validation results logged to {log_path}")
    
    def validate_all(
        self,
        data: pd.DataFrame,
        expected_columns: Optional[List[str]] = None,
        expected_types: Optional[Dict[str, type]] = None,
        value_ranges: Optional[Dict[str, Tuple[Optional[float], Optional[float]]]] = None,
        completeness_threshold: float = 0.20,
        check_duplicates: bool = False,
        log_path: Optional[str] = None
    ) -> Tuple[bool, Dict]:
        """
        Run all validations and return comprehensive results.
        
        Args:
            data: DataFrame to validate
            expected_columns: Optional list of expected columns
            expected_types: Optional dictionary of expected types
            value_ranges: Optional dictionary of value ranges
            completeness_threshold: Threshold for completeness validation
            check_duplicates: Whether to check for duplicates
            log_path: Optional path to save validation log
            
        Returns:
            Tuple of:
            - Boolean indicating if all validations passed
            - Dictionary containing detailed validation results
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'data_shape': data.shape,
            'validations_run': []
        }
        
        all_valid = True
        
        # Completeness validation
        completeness_valid, invalid_cols = self.validate_completeness(data, completeness_threshold)
        results['completeness_valid'] = completeness_valid
        results['completeness_invalid_columns'] = invalid_cols
        results['validations_run'].append('completeness')
        all_valid = all_valid and completeness_valid
        
        # Schema validation
        if expected_columns is not None:
            schema_valid = self.validate_schema(data, expected_columns)
            results['schema_valid'] = schema_valid
            results['validations_run'].append('schema')
            all_valid = all_valid and schema_valid
        
        # Type validation
        if expected_types is not None:
            type_valid, type_invalid_cols = self.validate_data_types(data, expected_types)
            results['type_valid'] = type_valid
            results['type_invalid_columns'] = type_invalid_cols
            results['validations_run'].append('types')
            all_valid = all_valid and type_valid
        
        # Range validation
        if value_ranges is not None:
            range_valid, range_invalid_rows = self.validate_value_ranges(data, value_ranges)
            results['range_valid'] = range_valid
            results['range_invalid_rows'] = {k: len(v) for k, v in range_invalid_rows.items()}
            results['validations_run'].append('ranges')
            all_valid = all_valid and range_valid
        
        # Duplicate validation
        if check_duplicates:
            duplicates_valid, duplicates = self.validate_no_duplicates(data)
            results['duplicates_valid'] = duplicates_valid
            results['duplicates_count'] = len(duplicates)
            results['validations_run'].append('duplicates')
            all_valid = all_valid and duplicates_valid
        
        results['all_validations_passed'] = all_valid
        
        # Log results if path provided
        if log_path is not None:
            self.log_validation_results(results, log_path)
        
        if all_valid:
            self.logger.info("All validations passed")
        else:
            self.logger.error("Some validations failed")
        
        return all_valid, results

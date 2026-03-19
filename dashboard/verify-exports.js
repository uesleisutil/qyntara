#!/usr/bin/env node

/**
 * Script de Verificação de Exports
 * 
 * Verifica se todos os componentes implementados estão corretamente exportados
 * e podem ser importados no App.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando exports de componentes...\n');

const checks = [];

// Função auxiliar para verificar se arquivo existe
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Função auxiliar para verificar se export existe no arquivo
function hasExport(filePath, exportName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const patterns = [
      new RegExp(`export\\s+{[^}]*${exportName}[^}]*}`, 'm'),
      new RegExp(`export\\s+const\\s+${exportName}`, 'm'),
      new RegExp(`export\\s+function\\s+${exportName}`, 'm'),
      new RegExp(`export\\s+class\\s+${exportName}`, 'm'),
      new RegExp(`export\\s+default\\s+${exportName}`, 'm'),
    ];
    return patterns.some(pattern => pattern.test(content));
  } catch {
    return false;
  }
}

// Verificar componentes compartilhados
console.log('📦 Componentes Compartilhados (shared):\n');

const sharedComponents = [
  { name: 'StatusBadge', file: 'src/components/shared/StatusBadge.tsx' },
  { name: 'StatusBadgeLegend', file: 'src/components/shared/StatusBadge.tsx' },
  { name: 'ProgressBar', file: 'src/components/shared/ProgressBar.tsx' },
  { name: 'GoalProgressBar', file: 'src/components/shared/GoalProgressBar.tsx' },
  { name: 'Sparkline', file: 'src/components/shared/Sparkline.tsx' },
  { name: 'TemporalComparisonProvider', file: 'src/components/shared/TemporalComparison.tsx' },
  { name: 'TemporalComparisonToggle', file: 'src/components/shared/TemporalComparison.tsx' },
  { name: 'TemporalKPICard', file: 'src/components/shared/TemporalComparison.tsx' },
  { name: 'ComparisonValue', file: 'src/components/shared/TemporalComparison.tsx' },
  { name: 'NotificationCenter', file: 'src/components/shared/NotificationCenter.tsx' },
  { name: 'Breadcrumb', file: 'src/components/shared/Breadcrumb.tsx' },
  { name: 'FavoriteIcon', file: 'src/components/shared/FavoriteIcon.tsx' },
  { name: 'FavoritesPanel', file: 'src/components/shared/FavoritesPanel.tsx' },
  { name: 'KeyboardShortcutsHelp', file: 'src/components/shared/KeyboardShortcutsHelp.tsx' },
  { name: 'CrossFilterBar', file: 'src/components/shared/CrossFilterBar.tsx' },
  { name: 'ZoomControls', file: 'src/components/shared/ZoomControls.tsx' },
  { name: 'AnnotationModal', file: 'src/components/shared/AnnotationModal.tsx' },
  { name: 'Skeleton', file: 'src/components/shared/Skeleton.tsx' },
  { name: 'SkeletonTable', file: 'src/components/shared/SkeletonTable.tsx' },
  { name: 'SkeletonChart', file: 'src/components/shared/SkeletonChart.tsx' },
  { name: 'SkeletonCard', file: 'src/components/shared/SkeletonCard.tsx' },
  { name: 'LazyTab', file: 'src/components/shared/LazyTab.tsx' },
  { name: 'CacheIndicator', file: 'src/components/shared/CacheIndicator.tsx' },
  { name: 'OfflineIndicator', file: 'src/components/shared/OfflineIndicator.tsx' },
];

sharedComponents.forEach(({ name, file }) => {
  const filePath = path.join(__dirname, file);
  const exists = fileExists(filePath);
  const exported = exists && hasExport(filePath, name);
  
  const status = exported ? '✅' : exists ? '⚠️' : '❌';
  const message = exported ? 'OK' : exists ? 'Arquivo existe mas export não encontrado' : 'Arquivo não encontrado';
  
  console.log(`${status} ${name.padEnd(30)} - ${message}`);
  checks.push({ component: name, status: exported ? 'OK' : 'FAIL', message });
});

// Verificar index.ts de shared
console.log('\n📋 Verificando src/components/shared/index.ts:\n');
const sharedIndexPath = path.join(__dirname, 'src/components/shared/index.ts');
if (fileExists(sharedIndexPath)) {
  const indexContent = fs.readFileSync(sharedIndexPath, 'utf8');
  sharedComponents.forEach(({ name }) => {
    const hasExportInIndex = indexContent.includes(name);
    const status = hasExportInIndex ? '✅' : '❌';
    console.log(`${status} ${name.padEnd(30)} - ${hasExportInIndex ? 'Exportado no index' : 'NÃO exportado no index'}`);
    if (!hasExportInIndex) {
      checks.push({ component: `${name} (index)`, status: 'FAIL', message: 'Não exportado no index.ts' });
    }
  });
} else {
  console.log('❌ Arquivo index.ts não encontrado!');
}

// Verificar componentes de charts
console.log('\n📊 Componentes de Charts:\n');

const chartComponents = [
  { name: 'CandlestickChart', file: 'src/components/charts/CandlestickChart.tsx' },
  { name: 'ModelBreakdownTable', file: 'src/components/charts/ModelBreakdownTable.tsx' },
  { name: 'ConfusionMatrixChart', file: 'src/components/charts/ConfusionMatrixChart.tsx' },
  { name: 'ErrorDistributionChart', file: 'src/components/charts/ErrorDistributionChart.tsx' },
  { name: 'BenchmarkComparisonChart', file: 'src/components/charts/BenchmarkComparisonChart.tsx' },
  { name: 'FeatureImportanceChartEnhanced', file: 'src/components/charts/FeatureImportanceChartEnhanced.tsx' },
  { name: 'CorrelationHeatmap', file: 'src/components/charts/CorrelationHeatmap.tsx' },
];

chartComponents.forEach(({ name, file }) => {
  const filePath = path.join(__dirname, file);
  const exists = fileExists(filePath);
  const exported = exists && hasExport(filePath, name);
  
  const status = exported ? '✅' : exists ? '⚠️' : '❌';
  const message = exported ? 'OK' : exists ? 'Arquivo existe mas export não encontrado' : 'Arquivo não encontrado';
  
  console.log(`${status} ${name.padEnd(35)} - ${message}`);
  checks.push({ component: name, status: exported ? 'OK' : 'FAIL', message });
});

// Verificar index.ts de charts
console.log('\n📋 Verificando src/components/charts/index.ts:\n');
const chartsIndexPath = path.join(__dirname, 'src/components/charts/index.ts');
if (fileExists(chartsIndexPath)) {
  const indexContent = fs.readFileSync(chartsIndexPath, 'utf8');
  chartComponents.forEach(({ name }) => {
    const hasExportInIndex = indexContent.includes(name);
    const status = hasExportInIndex ? '✅' : '❌';
    console.log(`${status} ${name.padEnd(35)} - ${hasExportInIndex ? 'Exportado no index' : 'NÃO exportado no index'}`);
    if (!hasExportInIndex) {
      checks.push({ component: `${name} (index)`, status: 'FAIL', message: 'Não exportado no index.ts' });
    }
  });
} else {
  console.log('❌ Arquivo index.ts não encontrado!');
}

// Resumo
console.log('\n' + '='.repeat(80));
console.log('📊 RESUMO DA VERIFICAÇÃO\n');

const totalChecks = checks.length;
const passedChecks = checks.filter(c => c.status === 'OK').length;
const failedChecks = checks.filter(c => c.status === 'FAIL').length;

console.log(`Total de verificações: ${totalChecks}`);
console.log(`✅ Passou: ${passedChecks}`);
console.log(`❌ Falhou: ${failedChecks}`);

if (failedChecks > 0) {
  console.log('\n⚠️  PROBLEMAS ENCONTRADOS:\n');
  checks.filter(c => c.status === 'FAIL').forEach(({ component, message }) => {
    console.log(`  ❌ ${component}: ${message}`);
  });
  console.log('\n💡 Ação necessária: Corrija os exports acima antes de integrar no App.js');
  process.exit(1);
} else {
  console.log('\n✅ Todos os componentes estão corretamente exportados!');
  console.log('✅ Pronto para integração no App.js');
  process.exit(0);
}

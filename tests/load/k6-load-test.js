/**
 * k6 Load Testing Script
 * 
 * Simulates concurrent users accessing the dashboard API.
 * Subtask 31.5 - Load Testing
 * 
 * Run: k6 run tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 500 },     // Ramp up to 500 users
    { duration: '2m', target: 1000 },    // Ramp up to 1000 users
    { duration: '2m', target: 1000 },    // Stay at 1000 users
    { duration: '30s', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],    // 95% of requests < 500ms
    errors: ['rate<0.01'],               // Error rate < 1%
    api_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  // Test API endpoints
  const endpoints = [
    '/api/recommendations',
    '/api/metrics',
    '/api/data-quality/completeness',
    '/api/drift/data-drift',
    '/api/costs/trends',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = `${BASE_URL}${endpoint}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '10s',
  };

  const res = http.get(url, params);

  apiDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!success);

  sleep(Math.random() * 2 + 0.5); // Random sleep 0.5-2.5s
}

export function handleSummary(data) {
  return {
    'tests/load/results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  const metrics = data.metrics;
  return `
Load Test Results
=================
Total Requests: ${metrics.http_reqs?.values?.count || 0}
Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
p95 Response Time: ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms
p99 Response Time: ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(0) || 'N/A'}ms
Avg Response Time: ${metrics.http_req_duration?.values?.avg?.toFixed(0) || 'N/A'}ms
`;
}

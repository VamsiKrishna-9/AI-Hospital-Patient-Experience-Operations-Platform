/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Configuration for future Python FastAPI Backend & MySQL hospital_db.
 *
 * Current State:
 * - Frontend running in standalone Demo Mode.
 * - Future endpoints map to FastAPI routes connected to MySQL Medallion Architecture:
 *   Bronze layer tables: bronze_patients, bronze_doctors, bronze_encounters,
 *   bronze_feedback, bronze_lab_results, bronze_prescriptions, bronze_staff,
 *   bronze_staff_assignment, bronze_appointments.
 * - Power BI will read curated Gold operational views for analytics.
 */

export const API_CONFIG = {
  // Configurable base URL for future FastAPI server
  baseUrl: (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeoutMs: 8000,
  isBackendConnected: false, // Explicit: false until real FastAPI server is running
  endpoints: {
    login: '/auth/login',
    registerPatient: '/auth/register/patient',
    registerDoctor: '/auth/register/doctor',
    registerStaff: '/auth/register/staff',
    registerAdmin: '/auth/register/admin',
    forgotPassword: '/auth/forgot-password',
    verifyCode: '/auth/verify-code',
    resetPassword: '/auth/reset-password',
    verifyInvite: '/auth/verify-invitation',
  },
  databaseMetadata: {
    dbName: 'hospital_db',
    architecture: 'Medallion Lakehouse Architecture',
    layers: {
      bronze: [
        'bronze_patients',
        'bronze_doctors',
        'bronze_encounters',
        'bronze_feedback',
        'bronze_lab_results',
        'bronze_prescriptions',
        'bronze_staff',
        'bronze_staff_assignment',
        'bronze_appointments',
      ],
      silver: ['silver_dim_patients', 'silver_dim_doctors', 'silver_fact_encounters', 'silver_fact_appointments'],
      gold: ['gold_hospital_operations_kpis', 'gold_patient_experience_metrics', 'gold_powerbi_executive_view'],
    },
    analyticsIntegration: 'Microsoft Power BI Embedded / DirectQuery on Gold views',
  },
};

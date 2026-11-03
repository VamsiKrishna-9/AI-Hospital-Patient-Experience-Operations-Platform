/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { getSupabaseAdmin } from '../src/server/supabase.js';

async function inspectSchema() {
  const client = getSupabaseAdmin();
  if (!client) {
    console.error('Supabase admin client not configured.');
    process.exit(1);
  }

  // Insert a test row with minimal required fields to discover exact columns
  const { data, error } = await client
    .from('silver_appointments')
    .insert({
      patient_id: 'P000001',
      doctor_id: 'DOC-001',
      appointment_date: '2026-12-01',
      appointment_time: '10:00',
      consultation_type: 'In-Person',
      status: 'Scheduled',
    })
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('Successfully inserted test appointment:', data);
    // Clean up test appointment
    await client.from('silver_appointments').delete().eq('appointment_id', data.appointment_id);
  }
}

inspectSchema().catch(console.error);

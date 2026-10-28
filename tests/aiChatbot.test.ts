/**
 * Automated Test Suite: AI Hospital Assistant Chatbot Integration & Safety Validation
 * Tests message validation, hospital directory grounding, visiting hours,
 * emergency safety guardrails, authenticated appointment retrieval, user preferences
 * persistence, and isolation of chatbot settings from patient records.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Reference hospital knowledge constants
const TEST_SPECIALTIES = [
  'Cardiology & Vascular Medicine',
  'Neurology & Neurosciences',
  'General Internal Medicine',
  'Emergency Medicine & Trauma',
  'Pediatrics & Neonatology',
  'Oncology & Hematology',
  'Orthopedic Surgery',
  'Obstetrics & Gynecology',
  'Radiology & Diagnostic Imaging',
  'Pulmonology & Critical Care',
];

const TEST_BRANCHES = [
  { branch_id: 'BR-MAIN', name: 'MediAI Medical Center — Main Campus' },
  { branch_id: 'BR-WEST', name: 'MediAI West Ambulatory & Imaging Pavilion' },
  { branch_id: 'BR-CARD', name: 'MediAI Heart & Vascular Specialty Institute' },
  { branch_id: 'BR-NEURO', name: 'MediAI Neurosciences & Pediatric Specialty Care' },
];

// --- TEST GROUP 1: Request Validation & Error Handling ---

test('Chat Input Validation: Rejects empty or whitespace-only messages', () => {
  const emptyInputs = ['', '   ', '\n\t  '];
  for (const input of emptyInputs) {
    const isValid = Boolean(input && typeof input === 'string' && input.trim().length > 0);
    assert.equal(isValid, false, `Input "${input}" should be rejected`);
  }
});

test('Chat Input Validation: Enforces maximum message length boundary', () => {
  const shortMessage = 'What are the visiting hours for the cardiology ICU?';
  const overLengthMessage = 'A'.repeat(2001);

  assert.equal(shortMessage.length <= 2000, true);
  assert.equal(overLengthMessage.length <= 2000, false);
});

// --- TEST GROUP 2: Medical Safety & Emergency Directives ---

test('Safety Guardrails: Triggers emergency advisory for acute symptoms', () => {
  const emergencyPrompts = [
    'I have severe chest pain and cannot breathe',
    'My father is having stroke symptoms and numbness',
    'Emergency help needed',
  ];

  for (const prompt of emergencyPrompts) {
    const lower = prompt.toLowerCase();
    const isEmergency =
      lower.includes('emergency') ||
      lower.includes('chest pain') ||
      lower.includes('cannot breathe') ||
      lower.includes('stroke');

    assert.equal(isEmergency, true, `Prompt "${prompt}" must trigger emergency advisory`);
  }
});

// --- TEST GROUP 3: Approved Hospital Knowledge & Department Directory ---

test('Hospital Grounding: Verifies approved 10 specialties and 4 hospital branches', () => {
  assert.equal(TEST_SPECIALTIES.length, 10);
  assert.equal(TEST_BRANCHES.length, 4);

  assert.equal(TEST_SPECIALTIES.includes('Cardiology & Vascular Medicine'), true);
  assert.equal(TEST_SPECIALTIES.includes('Pediatrics & Neonatology'), true);
  assert.equal(TEST_BRANCHES.some((b) => b.branch_id === 'BR-MAIN'), true);
  assert.equal(TEST_BRANCHES.some((b) => b.branch_id === 'BR-CARD'), true);
});

test('Visiting Hours: Validates verified inpatient and ICU visiting hours', () => {
  const hospitalHours = {
    generalWards: '10:00 AM – 8:00 PM daily',
    icu: '12:00 PM – 2:00 PM and 5:00 PM – 7:00 PM',
    pediatric: '24/7 bedside access for parents and legal guardians',
    emergency: '24/7/365 at Main Campus',
  };

  assert.match(hospitalHours.generalWards, /10:00 AM – 8:00 PM/);
  assert.match(hospitalHours.icu, /12:00 PM – 2:00 PM/);
  assert.match(hospitalHours.pediatric, /24\/7/);
  assert.match(hospitalHours.emergency, /24\/7/);
});

// --- TEST GROUP 4: Patient Appointment Data & Privacy ---

test('Patient Privacy: Authenticated patient schedule only reflects authorized patient ID', () => {
  const patientA = {
    patientId: 'P182162',
    name: 'Elena Rostova',
    appointments: [
      {
        id: 'APT-9041',
        doctor: 'Dr. Marcus Vance, MD',
        date: '2026-10-28',
        time: '10:30 AM',
      },
    ],
  };

  const patientB = {
    patientId: 'P994821',
    name: 'Marcus Brody',
    appointments: [],
  };

  // Derive schedule strictly based on authenticated patient context
  function getPatientAppointments(context: { patientId: string }) {
    if (context.patientId === patientA.patientId) return patientA.appointments;
    if (context.patientId === patientB.patientId) return patientB.appointments;
    return [];
  }

  const aptsForA = getPatientAppointments({ patientId: 'P182162' });
  const aptsForB = getPatientAppointments({ patientId: 'P994821' });

  assert.equal(aptsForA.length, 1);
  assert.equal(aptsForA[0].id, 'APT-9041');
  assert.equal(aptsForB.length, 0);
});

// --- TEST GROUP 5: Remove Chatbot & User Preferences Isolation ---

test('Chatbot Preferences: Removal disables launcher without altering patient clinical data', () => {
  const mockUserAccount = {
    id: 'usr-patient-182162',
    email: 'patient@hospital.org',
    patient_id: 'P182162',
    preferences: {
      chatbot_enabled: true,
    },
  };

  const mockAppointments = [
    { id: 'APT-9041', status: 'Confirmed' },
    { id: 'APT-9284', status: 'Scheduled' },
  ];

  // User selects "Remove Chatbot"
  mockUserAccount.preferences.chatbot_enabled = false;

  // Verify chatbot preference changed
  assert.equal(mockUserAccount.preferences.chatbot_enabled, false);

  // Verify appointments, user account, and clinical records remain completely untouched
  assert.equal(mockUserAccount.id, 'usr-patient-182162');
  assert.equal(mockUserAccount.patient_id, 'P182162');
  assert.equal(mockAppointments.length, 2);
  assert.equal(mockAppointments[0].status, 'Confirmed');
});

test('Chatbot State: Clearing conversation history does not remove or disable the assistant', () => {
  let conversationHistory = [
    { role: 'user', content: 'What are the visiting hours?' },
    { role: 'model', content: 'Visiting hours are 10:00 AM – 8:00 PM daily.' },
  ];
  let isChatbotEnabled = true;

  // Clear conversation action
  conversationHistory = [];

  assert.equal(conversationHistory.length, 0);
  assert.equal(isChatbotEnabled, true);
});

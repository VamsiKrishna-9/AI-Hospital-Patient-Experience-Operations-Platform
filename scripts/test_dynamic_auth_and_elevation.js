import http from 'node:http';

function postJson(path, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting MediAI Dynamic Auth, Google SSO & Role Elevation Test Suite...\n');

  // Test 1: Signup with default role "patient"
  const testEmail = `newuser_${Date.now()}@example.com`;
  console.log(`1. Testing dynamic signup (Default role = patient) for ${testEmail}...`);
  const regRes = await postJson('/api/auth/common-register', {
    fullName: 'Jane Doe',
    email: testEmail,
    password: 'SecurePassword@123',
  });

  if (!regRes.body.success || regRes.body.role !== 'patient') {
    throw new Error(`Signup failed or role is not patient: ${JSON.stringify(regRes.body)}`);
  }
  const patientId = regRes.body.patientId;
  const initialToken = regRes.body.token;
  console.log(`   ✓ PASS: Registered successfully with default role "${regRes.body.role}" and Patient ID: ${patientId}\n`);

  // Test 2: Login via Common Login using email
  console.log('2. Testing login via Common Login using registered email...');
  const loginRes = await postJson('/api/auth/common-login', {
    identifier: testEmail,
    password: 'SecurePassword@123',
  });

  if (!loginRes.body.success || loginRes.body.role !== 'patient') {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }
  console.log(`   ✓ PASS: Logged in successfully. Dynamic role resolved: "${loginRes.body.role}"\n`);

  // Test 3: Login via Common Login using Patient ID
  console.log('3. Testing login via Common Login using assigned Patient ID...');
  const patientIdLoginRes = await postJson('/api/auth/common-login', {
    identifier: patientId,
    password: 'SecurePassword@123',
  });

  if (!patientIdLoginRes.body.success || patientIdLoginRes.body.role !== 'patient') {
    throw new Error(`Patient ID login failed: ${JSON.stringify(patientIdLoginRes.body)}`);
  }
  console.log(`   ✓ PASS: Patient ID login succeeded for ${patientId}\n`);

  // Test 4: Elevate account from "patient" to "admin" (Platform Admin)
  console.log('4. Testing self-elevation from Patient to Platform Admin ("after first login i will update my self as platform admin role")...');
  const elevateRes = await postJson(
    '/api/auth/update-role',
    {
      newRole: 'admin',
      email: testEmail,
      patientId: patientId,
    },
    initialToken
  );

  if (!elevateRes.body.success || elevateRes.body.user.role !== 'admin') {
    throw new Error(`Elevation failed: ${JSON.stringify(elevateRes.body)}`);
  }
  const adminToken = elevateRes.body.token;
  console.log(`   ✓ PASS: Role successfully elevated to "${elevateRes.body.user.role}". New admin token issued.\n`);

  // Test 5: Verify new admin token has access to executive admin operational API
  console.log('5. Verifying elevated account access to Admin Executive Governance API...');
  const adminApiRes = await getJson('/api/admin/overview', adminToken);
  if (!adminApiRes.body.success || !adminApiRes.body.executiveMetrics) {
    throw new Error(`Admin overview API rejected elevated user: ${JSON.stringify(adminApiRes.body)}`);
  }
  console.log(`   ✓ PASS: Admin overview fetched with ${adminApiRes.body.departments?.length || 0} departments and bed occupancy ${adminApiRes.body.executiveMetrics.bedOccupancyRate}%\n`);

  // Test 6: Google SSO registration and elevation
  console.log('6. Testing Google SSO Login (Default role = patient)...');
  const googleRes = await postJson('/api/auth/google', {
    email: 'nsharan1862@gmail.com',
    name: 'Sharan N',
  });

  if (!googleRes.body.success || googleRes.body.role !== 'patient') {
    throw new Error(`Google SSO failed: ${JSON.stringify(googleRes.body)}`);
  }
  console.log(`   ✓ PASS: Google SSO authenticated. Assigned role: "${googleRes.body.role}"\n`);

  // Test 7: Elevate Google account to Platform Admin
  console.log('7. Testing elevation of Google account to Platform Admin...');
  const googleElevateRes = await postJson(
    '/api/auth/update-role',
    {
      newRole: 'admin',
      email: 'nsharan1862@gmail.com',
    },
    googleRes.body.token
  );

  if (!googleElevateRes.body.success || googleElevateRes.body.user.role !== 'admin') {
    throw new Error(`Google account elevation failed: ${JSON.stringify(googleElevateRes.body)}`);
  }
  console.log(`   ✓ PASS: Google account elevated to "${googleElevateRes.body.user.role}"\n`);

  // Test 8: Re-login via Google SSO to confirm persisted elevated Admin role
  console.log('8. Testing subsequent Google SSO login preserves elevated Platform Admin role...');
  const googleReloginRes = await postJson('/api/auth/google', {
    email: 'nsharan1862@gmail.com',
    name: 'Sharan N',
  });

  if (!googleReloginRes.body.success || googleReloginRes.body.role !== 'admin') {
    throw new Error(`Google re-login did not preserve elevated admin role: ${JSON.stringify(googleReloginRes.body)}`);
  }
  console.log(`   ✓ PASS: Google SSO preserved elevated role: "${googleReloginRes.body.role}"\n`);

  console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

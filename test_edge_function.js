// Test Edge Function: dashboard-promotor-monthly
// Test untuk DINDA CHRISTANTI (user_id: 185acbd0-5361-47cd-83d4-da4750c80c58)

const SUPABASE_URL = 'https://gqvmdleyvwhznwjikivf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxdm1kbGV5dndoem53amlraXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNDA4NjEsImV4cCI6MjA0OTcxNjg2MX0.yB3FN61jbzddxMIjDRYl8K2fLzJfLHnbmprHc8Bc5A0';

// DINDA's user ID
const DINDA_USER_ID = '185acbd0-5361-47cd-83d4-da4750c80c58';

async function testEdgeFunction() {
    console.log('Testing dashboard-promotor-monthly for DINDA...');
    console.log('User ID:', DINDA_USER_ID);
    console.log('');

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-promotor-monthly`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                userId: DINDA_USER_ID
            })
        });

        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:');
        console.log(JSON.stringify(data, null, 2));

        if (data.target !== undefined) {
            console.log('');
            console.log('=== RESULT ===');
            console.log('Target value:', data.target);

            if (data.target === 25) {
                console.log('✅ TARGET CORRECT!');
            } else if (data.target === 0) {
                console.log('❌ TARGET IS 0 - SOMETHING WRONG');
            } else {
                console.log('⚠️ TARGET UNEXPECTED VALUE');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testEdgeFunction();

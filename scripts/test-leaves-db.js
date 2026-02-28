const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeaves() {
    console.log("Checking leaves table...");
    const { data, error } = await supabase
        .from('leaves')
        .select('*, employee:employees(name, department)')
        .order('start_date', { ascending: false });

    if (error) {
        console.error("Error fetching leaves:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

checkLeaves();

console.log("ENV CHECK START");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "PRESENT (" + process.env.SUPABASE_SERVICE_ROLE_KEY!.length + " chars)" : "NOT FOUND");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "PRESENT (" + process.env.DATABASE_URL!.length + " chars)" : "NOT FOUND");
console.log("SUPABASE_DB_URL:", process.env.SUPABASE_DB_URL ? "PRESENT" : "NOT FOUND");
console.log("PGHOST:", process.env.PGHOST ? "PRESENT" : "NOT FOUND");
console.log("ENV CHECK END");

async function main() {
  try {
    const res = await fetch('https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs'
      }
    });
    const data = await res.json();
    console.log("Keys of response:", Object.keys(data));
    if (data.paths) {
      console.log("Paths available count:", Object.keys(data.paths).length);
    } else {
      console.log("Full data:", JSON.stringify(data).slice(0, 1000));
    }
  } catch (err) {
    console.error("Error fetching schema:", err.message);
  }
}

main();

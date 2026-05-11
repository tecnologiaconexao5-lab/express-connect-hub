const http = require('http');

const req = http.get('http://localhost:8080', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data.substring(0, 500));
  });
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

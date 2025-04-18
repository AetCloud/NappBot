const os = require("os");
const process = require("process");

function getSystemMetrics() {
  const totalRam = os.totalmem() / 1024 / 1024 / 1024;
  const freeRam = os.freemem() / 1024 / 1024 / 1024;
  const usedRam = totalRam - freeRam;
  const cpuLoad = os.loadavg()[0];
  const uptime = os.uptime();
  const processMemory = process.memoryUsage().rss / 1024 / 1024;

  return {
    totalRam: totalRam.toFixed(2),
    usedRam: usedRam.toFixed(2),
    freeRam: freeRam.toFixed(2),
    cpuLoad: cpuLoad.toFixed(2),
    uptime: formatUptime(uptime),
    processMemory: processMemory.toFixed(2),
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = { getSystemMetrics };

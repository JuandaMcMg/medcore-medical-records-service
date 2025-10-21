const axios = require("axios");

function makeClient(baseURL) {
  const instance = axios.create({
    baseURL,
    timeout: 5000,
  });

  // pasa el Authorization original hacia el otro MS
  instance.interceptors.request.use((config) => {
    if (!config.headers) config.headers = {};
    if (config.meta?.forwardAuth && config.meta.forwardAuthToken) {
      config.headers.Authorization = config.meta.forwardAuthToken;
    }
    return config;
  });

  return instance;
}

module.exports = { makeClient };

const axios = require("axios");

/**
 * Crea una instancia de Axios con baseURL y timeout preconfigurados.
 *
 * Uso básico:
 *   const api = makeClient("http://localhost:3000/api");
 *   api.get("/users", {
 *     // Campo "meta" NO se envía por la red: solo sirve para la configuración previa
 *     meta: {
 *       forwardAuth: true,
 *       // Incluye el prefijo "Bearer " si tu backend lo requiere
 *       forwardAuthToken: "Bearer <jwt>",
 *     },
 *   });
 *
 * @param {string} baseURL - URL base para todas las solicitudes del cliente.
 * @returns {import('axios').AxiosInstance} instancia de Axios configurada.
 */
function makeClient(baseURL) {
  const instance = axios.create({ baseURL, timeout: 5000 });
  //Interceptor de solicitud: se ejecuta antes de enviar cada request
  instance.interceptors.request.use((config) => {
    if (!config.headers) config.headers = {};
    if (config.meta?.forwardAuth && config.meta.forwardAuthToken) {
      config.headers.Authorization = config.meta.forwardAuthToken; //Bearer Token
    }
    return config;
  });

  return instance;
}

module.exports = { makeClient };

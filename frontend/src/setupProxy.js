const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      onError: (err, req, res) => {
        console.log('Proxy Error:', err);
        res.status(500).send('Proxy Error');
      }
    })
  );
};
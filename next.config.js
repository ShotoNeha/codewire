/** @type {import('next').NextConfig} */
const nextConfig = {
  // RSS取得のためのCORSプロキシを使う場合の設定
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

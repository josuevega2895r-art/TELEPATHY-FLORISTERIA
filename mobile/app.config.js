module.exports = {
  expo: {
    name: 'Telephaty',
    slug: 'telephaty-mobile',
    version: '1.0.0',
    extra: {
      apiUrl: process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || ''
    },
    plugins: ['expo-secure-store']
  }
};

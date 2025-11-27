/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                brand: '#4F9DA6',
                surface: '#FFFFFF',
                bg: '#F4F6F8',
                text: '#0B1220',
                outline: '#E6E8EB'
            },
            borderRadius: { xl: '12px' }
        },
    },
    plugins: [],
}

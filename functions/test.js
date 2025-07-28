// functions/test.js (note: .js not .ts)
export default {
    async fetch(request) {
        return new Response(JSON.stringify({ message: "Test works!" }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    },
};
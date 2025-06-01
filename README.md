# ASMR One Cloudflare Worker (SSE MCP)

This Cloudflare Worker provides an MCP-like interface using Server-Sent Events (SSE) to search for ASMR works from the asmr-200.com API.

## Features

- Search ASMR works by keyword, RJ code, circle, tag, or voice actor.
- Get a random ASMR work.
- Returns results as Server-Sent Events.

## Prerequisites

- A Cloudflare account.
- [Node.js](https://nodejs.org/) and npm installed.
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/) installed globally or as a project dependency.

## Setup and Installation

1.  **Clone or download this worker's code into a directory.**
    (Assuming this `README.md` is already in the `asmr-one-cf-worker` directory within your project.)

2.  **Navigate to the worker directory:**
    ```bash
    cd path/to/your/project/asmr-one-cf-worker
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```
    This will install `@cloudflare/workers-types` for TypeScript support and `wrangler` for deployment.

## Configuration

(Currently, no specific environment variables are required for the worker itself, but `wrangler.toml` will be needed for deployment.)

Create a `wrangler.toml` file in the `asmr-one-cf-worker` directory with the following content. Replace `your-worker-name` with your desired worker name and `your-account-id` with your Cloudflare account ID.

```toml
name = "your-asmr-worker-name" # Choose a unique name for your worker
main = "index.ts"             # Entry point of your worker
compatibility_date = "2024-05-01" # Or a more recent date

# If you plan to use KV for storing tags (recommended for production)
# [[kv_namespaces]]
# binding = "ASMR_TAGS_KV"
# id = "your_kv_namespace_id_here" # Create a KV namespace in Cloudflare dashboard and put its ID here
```

To find your Cloudflare Account ID:
1. Log in to your Cloudflare dashboard.
2. Select any domain or go to the Workers & Pages overview.
3. Your Account ID is usually found in the right sidebar or in the URL.

## Usage

The worker exposes the following SSE endpoints:

-   **`/sse/search?query=<search_term>&order=<order>&sort=<sort>&page=<num>&pageSize=<num>&subtitle=<0|1>&includeTranslationWorks=<true|false>&link_type=<asmr_one|dlsite>`**
    -   `query`: (Required) The search term.
        -   Plain text for keyword search.
        -   `RJ123456` or `rj123456` for specific work ID.
        -   `$tag:TagName` for tag search (e.g., `$tag:耳舐め`).
        -   `$circle:CircleName` for circle search.
        -   `$va:VoiceActorName` for voice actor search.
    -   `order`: (Optional) Order of results. Enum: `"nsfw"`, `"popular"`, `"new"`. Default: `"nsfw"`.
    -   `sort`: (Optional) Sort order. Enum: `"asc"`, `"desc"`. Default: `"asc"`.
    -   `page`: (Optional) Page number. Default: `1`.
    -   `pageSize`: (Optional) Number of results per page. Default: `20`.
    -   `subtitle`: (Optional) Subtitle filter. `0` for no filter, `1` for with subtitle. Default: `0`.
    -   `includeTranslationWorks`: (Optional) Include translated works. Boolean. Default: `true`.
    -   `link_type`: (Optional) Type of link to return. Enum: `"asmr_one"`, `"dlsite"`. Default: `"asmr_one"`.

    **Example:** `https://your-worker-name.your-subdomain.workers.dev/sse/search?query=$tag:ASMR&pageSize=5`

-   **`/sse/random`**
    -   Fetches a random ASMR work.

    **Example:** `https://your-worker-name.your-subdomain.workers.dev/sse/random`

### SSE Events

The worker will send events of the following types:

-   `info`: Informational messages (e.g., "Requesting URL: ...").
-   `data`: The actual data payload (search results or random work).
-   `error`: Error messages if something goes wrong.

The stream closes after the data is sent or an error occurs.

## Local Development

You can run the worker locally for testing using Wrangler:

```bash
npm run dev
# or
wrangler dev
```

This will start a local server, typically at `http://localhost:8787`.

## Deployment to Cloudflare

1.  **Login to Wrangler (if you haven't already):**
    ```bash
    wrangler login
    ```

2.  **Deploy the worker:**
    ```bash
    npm run deploy
    # or
    wrangler deploy
    ```

    Wrangler will build and deploy your `index.ts` file to Cloudflare Workers. After deployment, it will output the URL where your worker is live.

## Cloudflare "Deploy with Workers" Button

To add a "Deploy with Workers" button, you can include the following Markdown in your main project's README or wherever you want to feature it:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yukikazechan/asmr-one-cf-worker)

**Important:**
- The URL above assumes that the `asmr-one-cf-worker` contents (including `wrangler.toml`, `package.json`, and `index.ts`) are at the root of the `yukikazechan/asmr-one-cf-worker` repository.
- If these files are in a subdirectory within that repository (e.g., `yukikazechan/asmr-one-cf-worker/worker-code/`), you'll need to adjust the `url` parameter in the button link accordingly (e.g., `https://deploy.workers.cloudflare.com/?url=https://github.com/yukikazechan/asmr-one-cf-worker/tree/main/worker-code`).

## Future Improvements

-   **Tag Caching with KV Store:** The `loadTags()` function currently loads tags into memory on each worker instance's cold start or on demand. For production, tags should be fetched periodically and stored in a Cloudflare KV Namespace. The worker would then read from KV, significantly improving performance and reducing API calls.
-   **More Robust Error Handling:** Enhance error messages and types.
-   **Input Validation:** Add more comprehensive validation for query parameters.
import axios from 'axios';
import { config } from 'dotenv';

config();

type Flags = Array<{ name: string; key: string; description: string }>;

const confluenceAuth = {
  username: process.env.CONFLUENCE_USERNAME!,
  password: process.env.CONFLUENCE_API_KEY!,
};

async function getFeatureFlags() {
  const resp = await fetch(
    `https://app.launchdarkly.com/api/v2/flags/${process.env
      .LAUNCHDARKLY_PROJECT_KEY!}?filterEnv:development`,
    {
      method: 'GET',
      headers: {
        Authorization: process.env.LAUNCHDARKLY_API_KEY!,
      },
    },
  );

  const data = await resp.json();

  return data.items.map((d: any) => ({
    name: d.name,
    key: d.key,
    description: d.description,
  }));
}

function generateTable(data: Flags) {
  const headers = '| *name* | *key* | *description* |\n';
  const rows = data
    .map((row) => `| ${row.name} | ${row.key} | ${row.description} |`)
    .join('\n');

  return `${headers}${rows}`;
}

async function updateConfluencePage(flags: Flags) {
  const table = generateTable(flags);

  const pageTitle = 'Feature flag summary';

  const searchPageUrl = `${process.env
    .CONFLUENCE_BASE_URL!}/rest/api/content?spaceKey=${
    process.env.CONFLUENCE_SPACE_KEY
  }&title=${encodeURIComponent(pageTitle)}&expand=version`;

  const response = await axios.get(searchPageUrl, { auth: confluenceAuth });

  const pageId =
    response.data.results.length > 0 ? response.data.results[0].id : null;

  if (pageId) {
    const updatePageUrl = `${process.env
      .CONFLUENCE_BASE_URL!}/rest/api/content/${pageId}`;
    const currentVersion = response.data.results[0].version.number;

    const payload = {
      id: pageId,
      type: 'page',
      title: pageTitle,
      space: {
        key: process.env.CONFLUENCE_SPACE_KEY!,
      },
      version: {
        number: currentVersion + 1,
      },
      body: {
        storage: {
          value: table,
          representation: 'wiki',
        },
      },
    };

    await axios.put(updatePageUrl, payload, { auth: confluenceAuth });
    console.log('Confluence page updated:', updatePageUrl);
  } else {
    console.log(
      `Couldn't find page with title "${pageTitle}" in Confluence space ${process.env.CONFLUENCE_SPACE_KEY}`,
    );
  }
}

async function run() {
  const flags = await getFeatureFlags();

  await updateConfluencePage(flags);
}

run();

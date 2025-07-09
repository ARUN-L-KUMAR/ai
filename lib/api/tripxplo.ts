const API_BASE = "https://api.tripxplo.com/v1/api";
const LOGIN_ENDPOINT = `${API_BASE}/admin/auth/login`;
const PACKAGE_ENDPOINT = `${API_BASE}/admin/package`;

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://admin.tripxplo.com",
  "Referer": "https://admin.tripxplo.com/",
  "User-Agent": "Mozilla/5.0",
};

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch(LOGIN_ENDPOINT, {
    method: "PUT",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      email: process.env.TRIPXPLO_EMAIL,
      password: process.env.TRIPXPLO_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const tokens = await response.json();
  cachedToken = tokens.accessToken;
  tokenExpiry = Date.now() + 3600000; // 1 hour

  if (!cachedToken) {
    throw new Error('No access token received');
  }

  return cachedToken;
}

export async function getPackages(search?: string): Promise<any[]> {
  const token = await getAccessToken();
  let allPackages: any[] = [];
  let offset = 0;
  const limit = 270;
  
  while (true) {
    const response = await fetch(`${PACKAGE_ENDPOINT}?limit=${limit}&offset=${offset}&search=${search || ''}`, {
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.status}`);
    }

    const data = await response.json();
    const packages = data.result?.docs || [];
    
    if (packages.length === 0) break;
    
    allPackages.push(...packages);
    
    if (packages.length < limit) break;
    
    offset += limit;
  }
  
  return allPackages;
}
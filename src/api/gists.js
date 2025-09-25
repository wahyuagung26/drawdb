import axios from "axios";

export const SHARE_FILENAME = "share.json";
export const VERSION_FILENAME = "versionned.json";

const description = "drawDB diagram";
const baseUrl = import.meta.env.VITE_BACKEND_URL;

export async function create(filename, content) {
  const res = await axios.post(`${baseUrl}/api/gists`, {
    public: false,
    filename,
    description,
    content,
  });

  return res.data.success ? res.data.data.id : res.data.id;
}

export async function patch(gistId, filename, content) {
  const { deleted } = await axios.patch(`${baseUrl}/api/gists/${gistId}`, {
    filename,
    content,
  });

  return deleted;
}

export async function del(gistId) {
  await axios.delete(`${baseUrl}/api/gists/${gistId}`);
}

export async function get(gistId) {
  const res = await axios.get(`${baseUrl}/api/gists/${gistId}`);

  return res.data;
}

export async function getCommits(gistId, perPage = 20, page = 1) {
  const res = await axios.get(`${baseUrl}/api/gists/${gistId}/commits`, {
    params: {
      per_page: perPage,
      page,
    },
  });

  return res.data;
}

export async function getVersion(gistId, sha) {
  const res = await axios.get(`${baseUrl}/api/gists/${gistId}/${sha}`);

  return res.data;
}

export async function getCommitsWithFile(
  gistId,
  file,
  limit = 10,
  cursor = null,
) {
  const res = await axios.get(
    `${baseUrl}/api/gists/${gistId}/file-versions/${file}`,
    {
      params: {
        limit,
        cursor,
      },
    },
  );

  return res.data;
}

/**
 * Author:    Mathias Nitzsche
 * Created:   2022-01-11
 * 
 * Rest API for Hashnode - deployed as Cloudflare Worker
 * 
 * Usage: /api/user/[user]/posts
 * Source: https://github.com/madmaxmatze/code/tree/main/hashnode-api
 **/
addEventListener('fetch', event => event.respondWith(
  handleRequest(event.request.url)
    .then(checkFetchError)
    .catch(handleError)
));

const handleRequest = async (url/*:string*/) => {
  url = url.replace(/\?.*/, "");
  var match = url.match(/api\/v1\/user\/(\w+)\/posts$/);
  if (match) {
    return fetchPosts(match[1]);
  }
  throw URIError("API call invalid");
};

const fetchPosts = async (username/*:string*/) => {
  var query = `{
    user(username: "${username}") {
      blogHandle
      publicationDomain
      publication {
        posts(page: 0) {
          dateAdded
          slug
          title
          brief
          coverImage
        }
      }
    }
  }`;

  var response = await fetch('https://api.hashnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  var json = await response.json();

  json.data.user.publication.posts.filter(post => (post.domain = json.data.user.publicationDomain));  
 
  return new Response(JSON.stringify(json.data.user.publication.posts), response);
};

const checkFetchError = async (response) => {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
};

const handleError = async (error) => (
  new Response(error.toString(), { status: error instanceof URIError ? 400 : 500 })
);

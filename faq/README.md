# My FAQs

Some notes and links...

## Github

[Basic GitHub Auth](https://docs.github.com/en/get-started/quickstart/set-up-git#next-steps-authenticating-with-github-from-git)

```
git config --global user.email ".."
git config --global user.name "..."
```

## Docker
quick nginx setup for static content: https://medium.com/google-cloud/google-cloud-run-or-how-to-run-your-static-website-in-5-minutes-and-much-more-dbe8f2804395

## MiniCube
minicube not starting:
> "Error while starting minikube. Error: X Exiting due to DRV_NOT_HEALTHY: Found driver(s) but none were healthy. See above for suggestions how to fix installed drivers."

`RUN minikube start --force --driver=docker*`

---
Connect to Pod in MiniCube
 - `docker ps` --> find MiniKube
 - `docker exec -it [CONTAINER_ID] /bin/bash`  
 - `docker ps -al`  --> find container to enter
 - `docker exec -it [CONTAINER_ID] /bin/bash`

 also: `docker logs [CONTAINER_ID]`

## GCP

- during compilation `no space left on device`

  List folder sizes: du -shc ~/* | sort -rh
  
  Delete trash: sudo rm -rf /home/lost+found

## Others
Webpack / Npm
 - build command: npx webpack
 - https://webpack.js.org/guides/getting-started/#basic-setup
 - Online test: https://stackblitz.com/github/webpack/webpack.js.org/tree/master/examples/getting-started?file=README.md&terminal=











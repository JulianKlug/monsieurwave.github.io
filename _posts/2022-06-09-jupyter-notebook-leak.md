---
title: 'Avoiding data leaks on github through jupyter notebooks'
date: 2022-06-15
permalink: /posts/jupyter-notebook-leak
tags:
  - python
---

## A. Preventing a data leakage
### Clear all notebooks automatically on commit

*Rationale*: run a filter over certain files before they are added to git. This will leave the original file on disk as-is, but commit the "cleaned" version.


1. Create a .gitattributes file in your repo

__.gitattributes:__
```
*.ipynb filter=jupyternotebook
```


2. Create a .gitconfig file in your repo

__.gitconfig:__
```
[filter "jupyternotebook"]
        clean = jupyter nbconvert --to=notebook --ClearOutputPreprocessor.enabled=True --stdout %f
        required
```

3. Add custom .gitconfig to local git config: `git config --local include.path ../.gitconfig`
- __N.B.__: this step has to be repeated every time the repo is cloned.

5. Verify that custom config was added to local git config

--> This hook should be run every time a file is added (`git add`)


__.git/config:__
```
...
[include]
        path = .gitconfig
```


## B. In case of a data leak already on github
### Clear all notebooks
Whilst in the repo:

`jupyter nbconvert --ClearOutputPreprocessor.enabled=True --inplace */*/*/*/*/*.ipynb`
(or nbconvert > 6.0: `jupyter nbconvert --clear-output --inplace */*/*/*/*/*.ipynb`)

where one should start from `*.ipynb` to as deep as your repo structure goes (`*/*/*/*/*/*`) in this case 

### Clean all jupyter notebooks already on github

Requirements: [BFG](https://rtyley.github.io/bfg-repo-cleaner/) (can be installed via brew)

Procedure as explained in [this blog post](https://rtyley.github.io/bfg-repo-cleaner/).
1. Remove your old local repo folder (keep it temporarily save): `mv example-repo example-repo-old`
2. Clone in mirror repo: `git clone --mirror git@github.com:example/example-repo.git`
3. __Target all jupyter notebooks of repo__: `bfg --delete-files "{*.ipynb}" example-repo.git/`
4. Rewrite history: `cd example-repo && git reflog expire --expire=now --all && git gc --prune=now --aggressive`
5. `git push`
6. Delete mirror repo (as well as your temporary copy of the old version): `cd ../ && rm -rf example-repo.git`
7. Re-download the clean version of the repo: `git clone git@github.com:example/example-repo.git`
8. __Repeat step 3 and 4 of part A.__ (reinstaure custom filter after cloning)

This essentially removes all history of these files. 
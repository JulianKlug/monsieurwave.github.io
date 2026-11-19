---
permalink: /
title: ""
excerpt: "About me"
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

I am a critical care physician currently working in the ICU of the Lausanne University Hospital and working in the [Geneva Stroke Lab](https://www.carreralab.com/) led by Prof. Emmanuel Carrera (Hôpitaux Universitaires de Genève). I further collaborate with Prof. Urs Pietsch on improving neurocritical and prehospital care. Previously, I had the opportunity to learn and work at the [MIP-lab](https://miplab.epfl.ch/) headed by Prof. Dimitri Van De Ville (EPFL) and the [Lee Lab](https://oto.hms.harvard.edu/people/daniel-lee) directed by Dr. Daniel Lee (Harvard, MEEI). My research centers on biomedical applications of artificial intelligence & machine learning, with a special focus on neurocritical care.

In addition to my clinical work and research, I love designing practical tools to enhance the care for patients and enjoy contributing to open-source projects. See [Kassandra](https://kassandra.julianklug.com), a tool to bring machine learning into my clinical practice. I have worked on PHI, a tool aiming to connect patients to their hospital caregivers before and after their stay and had a hand in peer-to-peer communication networks whilst running Vlynt.  

For a more formal account of my academic work, see my [Curriculum Vitae](https://www.julianklug.com/files/cv_julian_klug.pdf) or [Google Scholar](https://scholar.google.com/citations?user=uvlWXnAAAAAJ&hl=en).

---

Academic Projects

<style>
  /* Break the map out of the narrow content column on wide screens,
     reclaiming the right suffix (2/10) and left prefix (0.5/10) gutters. */
  .map-embed { margin: 1rem 0; }
  .map-embed iframe { width: 100%; height: 660px; border: 0; display: block; }
  @media (min-width: 1200px) {
    .map-embed { margin-left: -5%; margin-right: -20%; }
  }
  .map-pubs > summary { cursor: pointer; font-weight: 600; }
  .map-pubs ol { margin: .75rem 0 0; padding-left: 0; list-style: none; }
  .map-pubs li { border-top: 1px solid #eee; }
  .map-pubs .row { display: grid; grid-template-columns: 3.2rem 1fr; gap: .4rem; padding: .5rem; margin: 0 -.5rem; cursor: pointer; }
  .map-pubs .row:hover { background: #f3f2ee; }
  .map-pubs li.sel .row { background: #e8e6df; }
  .map-pubs .y { color: #999; font-variant-numeric: tabular-nums; }
  .map-pubs .j { color: #999; font-size: .9em; }
</style>

<div class="map-embed">
  <iframe src="/academic_map/embed.html" title="Research map: publications by year and domain" loading="lazy"></iframe>
</div>

A topographic map of my publications: height shows how much I have published in each domain; the slider filters by year.

<details class="map-pubs" id="publications">
  <summary>Publications</summary>
  <ol id="map-pubs"></ol>
</details>

<script>
  /* Header "Publications" links to /#publications: expand and reveal the list. */
  const revealPubs = () => {
    if (location.hash !== "#publications") return;
    const pubs = document.getElementById("publications");
    pubs.open = true;
    pubs.scrollIntoView();
  };
  revealPubs();
  window.addEventListener("hashchange", revealPubs);
  /* Same-page header click: the theme's smooth-scroll handles scrolling but
     never sets the hash, so open the list directly. */
  document.addEventListener("click", (e) => {
    if (e.target.closest('a[href$="#publications"]')) document.getElementById("publications").open = true;
  });

  fetch("/academic_map/data/works.json")
    .then((r) => r.json())
    .then((works) => {
      works.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
      const title = (w) => (w.doi ? `<a href="https://doi.org/${w.doi}">${w.title}</a>` : w.title);
      const row = (w) =>
        `<span class="y">${w.year}</span><span>${title(w)}${w.journal ? `<div class="j">${w.journal}</div>` : ""}</span>`;
      const list = document.getElementById("map-pubs");
      list.innerHTML = works.map((w, i) => `<li data-i="${i}"><div class="row">${row(w)}</div></li>`).join("");
      document.querySelector(".map-pubs > summary").textContent = `Publications (${works.length})`;

      /* Row click (outside the DOI link) selects the paper on the map.
         The iframe is same-origin, so its map API is reachable directly;
         papers are matched by title since each page parses its own JSON. */
      const frame = document.querySelector(".map-embed iframe");
      const map = () => frame.contentWindow.researchMap;
      const findWork = (w) => map()?.works.find((m) => m.title === w.title);

      list.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        const li = e.target.closest("li");
        const work = li && findWork(works[li.dataset.i]);
        if (!work) return;
        map().select(work);
        frame.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      /* Mirror the map selection (from row or pin clicks) onto the list. */
      const syncSelection = () => {
        const sel = map()?.state.selected;
        list.querySelectorAll("li").forEach((li) => li.classList.toggle("sel", sel?.title === works[li.dataset.i].title));
      };
      const listen = () => frame.contentDocument.addEventListener("map:refresh", syncSelection);
      const loaded = frame.contentWindow.location.href !== "about:blank" && frame.contentDocument.readyState === "complete";
      loaded ? listen() : frame.addEventListener("load", listen);
    });
</script>

---

Non-Academic Projects: 
- [Kassandra](https://kassandra.julianklug.com), bringing machine learning safely to clinical practice
- [PDF2Calendar](https://github.com/JulianKlug/PDF2Calendar), converting hospital shift pdf files to modern calendars   
- [FentaSim](http://fentasim.julianklug.com), a tool to simulate effect site concentrations of fentanyl
- [DD4PH](https://dd4ph.julianklug.com), a tool to help choosing the right measure of cardiac output for the diagnosis of pulmonary hypertension
- PHI, connect patients to their hospital 
- Vlynt, a peer-to-peer content delivery network
- [Formation continue (malgré le COVID)](https://www.youtube.com/playlist?list=PLReS_CqwBJr3Tj8cSut52INgPxar1XSxY), improvised socially-distanced lectures for medical and surgical residents (in french)
- I try to help out with great open-source projects, such as [nibabel](https://github.com/nipy/nibabel/commits?author=JulianKlug) and created some open-source tools such as [RandAugment3D](https://github.com/JulianKlug/RandAugment-3D)

---
permalink: /
title: "About me."
excerpt: "About me"
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

I am a critical care physician currently working in the ICU of Lausanne University Hospital and working in the [Geneva Stroke Lab](https://www.carreralab.com/) led by Prof. Emmanuel Carrera (Hôpitaux Universitaires de Genève). I further collaborate with Prof. Urs Pietsch on improving neurocritical and prehospital care. Previously, I had the opportunity to learn and work at the [MIP-lab](https://miplab.epfl.ch/) headed by Prof. Dimitri Van De Ville (EPFL) and the [Lee Lab](https://oto.hms.harvard.edu/people/daniel-lee) directed by Dr. Daniel Lee (Harvard, MEEI). My research centers on biomedical applications of artificial intelligence & machine learning, with a special focus on neurocritical care.

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
  .map-pubs .row { display: grid; grid-template-columns: 3.2rem 1fr; gap: .4rem; padding: .5rem; margin: 0 -.5rem; color: inherit; text-decoration: none; }
  .map-pubs a.row:hover { background: #f3f2ee; }
  .map-pubs .y { color: #999; font-variant-numeric: tabular-nums; }
  .map-pubs .j { color: #999; font-size: .9em; }
</style>

<div class="map-embed">
  <iframe src="/academic_map/embed.html" title="Research map: publications by year and domain" loading="lazy"></iframe>
</div>

A topographic map of my publications: height marks how densely I have worked a domain, the slider cuts the land by year.

<details class="map-pubs">
  <summary>Publications</summary>
  <ol id="map-pubs"></ol>
</details>

<script>
  fetch("/academic_map/data/works.json")
    .then((r) => r.json())
    .then((works) => {
      works.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
      const row = (w) =>
        `<span class="y">${w.year}</span><span>${w.title}${w.journal ? `<div class="j">${w.journal}</div>` : ""}</span>`;
      document.getElementById("map-pubs").innerHTML = works
        .map((w) => `<li>${w.doi ? `<a class="row" href="https://doi.org/${w.doi}">${row(w)}</a>` : `<div class="row">${row(w)}</div>`}</li>`)
        .join("");
      document.querySelector(".map-pubs > summary").textContent = `Publications (${works.length})`;
    });
</script>

---

Non-Academic Projects: 
- [Kassandra](https://kassandra.julianklug.com), bringing machine learning safely to clinical practice
- [PDF2Calendar](https://pdf2calendar.julianklug.com), converting hospital shift pdf files to modern calendars   
- [FentaSim](http://fentasim.julianklug.com), a tool to simulate effect site concentrations of fentanyl
- [DD4PH](https://dd4ph.julianklug.com), a tool to help choosing the right measure of cardiac output for the diagnosis of pulmonary hypertension
- PHI, connect patients to their hospital 
- Vlynt, a peer-to-peer content delivery network
- [Formation continue (malgré le COVID)](https://www.youtube.com/playlist?list=PLReS_CqwBJr3Tj8cSut52INgPxar1XSxY), improvised socially-distanced lectures for medical and surgical residents (in french)
- I try to help out with great open-source projects, such as [nibabel](https://github.com/nipy/nibabel/commits?author=JulianKlug) and created some open-source tools such as [RandAugment3D](https://github.com/JulianKlug/RandAugment-3D)

---
title: 'Research in Context: Machine learning for early dynamic prediction of functional outcome after stroke'
date: 2024-11-18
permalink: /posts/research/Reseach-in-context-OPSUM/
tags:
  - research
---

> **Key Question**: Can AI algorithms be used to monitor patients after acute ischemic stroke?


**Evidence before this study**

Stroke is the most frequent cause of long-term disability in industrialized countries. To determine the best treatment and allocate the necessary resources, an early and accurate prediction is essential. Scores derived from logistic regression analysis and more recently from machine learning have been developed but are rarely used in clinical practice. We expand the review by Akay et al. from 20231, and searched MEDLINE for studies published in any language up to September 19th 2023, using the terms (“stroke” OR “cerebrovascular accident”) AND (“machine learning” OR “artificial intelligence” OR “neural network”) AND (“mortality” OR “survival” OR “rankin” OR “mRS”). We screened 557 articles, of which 71 were relevant for our study. We identified two main reasons that limit the clinical relevance of the current models. First, the large majority existing model were static using data collected only at admission. Only one single study by Hu et al from 2022 used four timepoints to construct time-specific models. However, no existing study used the most recent development in machine learning to develop dynamic prediction models, integrating continuous data that are recorded during the first days after stroke admission. The second reason that limits the use of existing machine learning model after stroke relate to their lack of transparency. In the management of patients, predictions that are not associated with mechanistic explanations show limited acceptance and come with legal and ethical challenges.

**Added value of this study**

We developed a novel machine learning approach to provide real-time predictions of mortality and good functional outcome in 2942 admissions for acute ischemic stroke. More specifically, we used a transformer model that was designed to integrate continuously recorded sequential data. During the first 72 hours after admission, our model was able to provide accurate hourly prediction of mortality at three months based on updated clinical, physiological, and biological data. This approach allows the model to make use not only of static values available at a given time, but also of temporal trends of all priorly obtained data. The model provided updated, real-time explanations of the variables driving the predictions. We were able to determine which features impact the prediction of mortality in an individual patient, at any given timepoint. To our knowledge, this is the first model providing dynamic hourly prediction of mortality after stroke. 


**Implications of all the available evidence**

This study demonstrates the potential of machine learning models integrating multiple types of clinical, physiological, and biological variables over time after stroke. The good performance of our transformer model will certainly support the use of predictive models by clinicians who are traditionally reluctant to do so, current standard clinical care relying mostly on clinical knowledge and experience. The clinical applicability of our model will further be strengthened by access to hourly updated predictions along with accompanying explanations.


**References**
1.	Akay, E. M. Z. et al. Artificial Intelligence for Clinical Decision Support in Acute Ischemic Stroke: A Systematic Review. Stroke 54, 1505–1516 (2023).




_Full paper_: Klug, J., Leclerc, G., Dirren, E. et al. Machine learning for early dynamic prediction of functional outcome after stroke. Commun Med 4, 232 (2024). 
https://www.nature.com/articles/s43856-024-00666-w

![Concept](/images/opsum/concept.webp "Concept")

---
title: 'Generative AI for scientific illustration'
date: 2024-06-11
permalink: /posts/generative-ai-for-scientific-illustration
tags:
  - ICU
  - AI
---

Good illustrations are key for efficient scientific communication, education, and dissemination of knowledge. An image can easily convey complex concepts that are sometimes only cumbersomely captured in writing. In this light, more and more authors are making use of generative AI tools to create illustrations for their scientific publications. 

### _On the importance of checking model output_

With more and more illustrations created by AI, many inaccurate or misleading images are beeing published. Some with malicious intent [^1], others due to lack of knowledge on how to use the tools. Do these small errors matter? I would argue, that they are the image equivalent of spelling errors. Although the overall message might still be conveyed, the reader might be distracted by the error, or even worse, misinterpret the image. As most scientist are not trained in image editing, they appear more difficult to correct than a spelling error. However, with the right chaining of tools, this can be done in a few minutes.  

### _The iterative process_

When creating an illustration, it helps to use the generative AI tool as an interface to iterate over subsequent versions of the image [^2]. First, it can be used to generate a visual representation of the concept. Here, it can help to start from a sketch ("sketch-to-image") or from an existing image ("mutation").

Once a rough idea emerges, the image can be further refined. Areas can be erased ("removal") and new elements can be added ("inpainting"). Multiple images parts can be combined and the junctions can be smoothed with further inpainting. 

Finally, it often helps to correct minor errors manually. This can be done in a simple image editing software [^3].

![Iterative process](/images/random/iterative_process.png "Iterative process")

Current generations of generative AI are still limited in their ability to generate images outside their training data. 
A few practical considerations are listed below:

### _Where can generative AI be helpful?_

Generative AI performs well for: 
- icons
- common objects/tools
- correcting parts of an image
- joining existing images
- generate variations of an existing image

### _Where will generative AI fail?_

Generative AI will fail for: 
- medical images: US, CT, MRI, Rx 
- data representations: ECG, EEG
- uncommon objects/tools: BIS monitor, intra-cerebral pressure monitor
- anatomical structures
- lines/tubing 

Common generative AI models will generally fail when asked to create specific medical data representations. However, specific models exist for this aim [^4].

### _What tool to use?_

With the current pace of updates in the field, any list will be outdated in a few months. 
However, here are a few models that are currently popular: 
- Models: DALL-E (OpenAI), MidJourney (Midjourney, Inc.), Stable Diffusion (Stability AI)
- Image generation interface: [Bing](https://www.bing.com/search?q=Bing+AI&showconv=1&FORM=hpcodx) (gives free access to DALL-E)
- Image modification interface: [Getimg.ai](https://getimg.ai/image-editor) (gives access to Stable Diffusion inpainting and object removal, lots of free credits)
- Image variations interface: [Fotor](https://www.fotor.com/) 

### Recommendations 

Practically:
- Remain critical of generated images
- Correct generated images through inpainting / removal / image editing 
- Check if journal allows publication of generated images
- Clearly state if an illustration was created with the help of AI tools
- Verify generated images are free of bias

_Full paper_: [Klug, J., Pietsch, U. Can artificial intelligence help for scientific illustration? Details matter. Crit Care 28, 196 (2024).](https://rdcu.be/dKt1E)


### References:
[^1]: Guo X, Dong L, Hao D. RETRACTED: Cellular functions of spermatogonial stem cells in relation to JAK/STAT signaling pathway. Front Cell Dev Biol. 2024 Feb 13;11. 

[^2]: Thoring K, Huettemann S, Mueller RM. THE AUGMENTED DESIGNER: A RESEARCH AGENDA FOR GENERATIVE AI-ENABLED DESIGN. Proc Des Soc. 2023 Jul;3:3345–54. 

[^3]: The GIMP Development Team. GIMP. GIMP. Available from: https://www.gimp.org/

[^4]: Mendez M, Sundararaman S, Probyn L, Tyrrell PN. Approaches and Limitations of Machine Learning for Synthetic Ultrasound Generation. Journal of Ultrasound in Medicine. 2023;42(12):2695–706. 



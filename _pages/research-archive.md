---
layout: archive
permalink: /research/
title: "Research"
author_profile: true
---

{% include base_path %}
{% include group-by-array collection=site.posts field="tags" %}

{% for tag in group_names %}
  {% assign posts = group_items[forloop.index0] %}
  {% for post in posts %}
    {% if tag == "research" %}
        {% include archive-single.html %}
    {% endif %}  
  {% endfor %}
{% endfor %}

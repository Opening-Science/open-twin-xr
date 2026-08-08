# OpenTwin: annotated reference map

**What this is:** the sources behind `RESEARCH.md`, `FORK_PLAN.md` and `MODEL_INTEGRATION.md`, organised by theme, each with a short summary, its licence, and why it matters here. Plus one section of new work: a deep dive on **ICD-10 to anatomical structure mapping**, which was the pattern the PMC12524217 seed pointed at.

**How to read the confidence markers.** **[M]** means measured or computed directly in this session, not read from documentation. **[?]** flags something I could not verify and that should be checked before it carries weight. Everything else was fetched from the cited URL.

---

## 1. The six seed sources, assessed

| Seed | What it actually is | Verdict |
|---|---|---|
| **biodigital.com** | The proprietary incumbent. Its moat is the iframe embed plus a postMessage API plus the Human Studio authoring tool, not the geometry. In **May 2026 it cut the free tier** to A&P content only, 10 model views per month, 5 saved models, and removed self-service org trials | Study the embed and API design, ignore the content volume. The free-tier cut is a market opening with a shelf life |
| **NAVER ANNY** | Apache-2.0 code, CC0 assets, infant-to-elder parametric body. The correct foundation if you want a parametric human at all | Adopt. See `MODEL_INTEGRATION.md`. Note the ANNY *paper* is arXiv:2511.03589, not the arXiv link in the seed list |
| **PMC12524217** | A 34-person usability study of a WebGL EMR front-end mapping ICD-10 onto BioDigital's proprietary models. SUS 70.42, no control group, **mapping table never published** | Useful as an architecture precedent and an evaluation instrument. Not a reusable artefact. §2 below, and specifically §2.4, works out what to build instead |
| **JHU BodyMaps** | The most impressive CT segmentation programme in the field, and **CC BY-NC-SA** throughout, with SuPreM weights at **CC BY-NC-ND plus patents pending** | Research and benchmarking only. Never in a shipped artefact. TotalSegmentator is the clean equivalent |
| **arXiv 2406.06464** | Not a body-model paper. It is **PHIA**, an LLM agent over wearable time series, now in *Nature Communications* 2026 (17:1143, published 12 January 2026; the "025" in the DOI is the submission year) | Recategorise: it belongs to the interpretation layer, and it is the anchor for `FORK_PLAN.md` §2 |
| **usinenouvelle N322517** | A French trade-press survey from roughly 2014 to 2015 (Human Brain Project, Visible Patient, Living Heart launch) | Historical framing only. Its 2016 to 2018 predictions did not land on schedule |

---

## 2. ICD-10 to anatomical structure mapping

This is the section the seed pointed at and the paper did not deliver. The goal: `ICD-10 code → UBERON or FMA CURIE → mesh`, redistributable under MIT.

### 2.1 What PMC12524217 actually did

Liu, Lai and Chiang, *Healthcare* (Basel) 2025, 13(19), 2393, DOI 10.3390/healthcare13192393. National Chung-Cheng University with St. Martin De Porres Hospital and Taichung Tzu-Chi Hospital, Taiwan. MDPI, so CC BY 4.0 and fully quotable.
https://pmc.ncbi.nlm.nih.gov/articles/PMC12524217/ · https://www.mdpi.com/2227-9032/13/19/2393

**The architecture:** doctor-entry web frontend → text records database → RESTful API engine → an "ICD-to-model logic layer, which cross-references structured diagnosis entries with an embedded model registry" → BioDigital Human API → WebGL rendering with rotate, slice, zoom and annotate. No FHIR. No production EMR integration. It is a standalone prototype over its own records database.

**The critical negative finding: there is no reproducible methodology.** No curation process, no curator count, no statement of whether mapping is per-code or by range, no coverage figure, no granularity policy. Granularity is organ-level ("organ-specific 3D models"). ICD-10 and SNOMED CT are name-checked "for semantic alignment" and nothing more. Data availability: raw data "on request". **No mapping table or supplementary file was published.**

A related check worth recording: **BioDigital's public Content API documents no ICD lookup endpoint** (https://github.com/biodigital-inc/bdhuman-contentapi). The `findModel(String ICD)` method visible in their Android SDK docs suggests an internal disease index exists, but nothing citable documents it, so the paper's registry is almost certainly their own unpublished table.

**Evaluation, in full:** n = 34 (5 physicians, 8 nurses, 21 medical students), 30 minutes familiarisation, standard 10-item SUS, **mean 70.42**. No task times, no error rates, no per-item scores, no standard deviations, no significance tests, **no subgroup analysis** between physicians, nurses and students.

**Their own limitations, verbatim:**

> "The current system architecture is less effective at representing non-localizable or non-visual disease categories, including psychiatric conditions, autoimmune syndromes, and genetically inherited disorders."

> "Although the SUS results are promising, they do not constitute a comparative performance benchmark against conventional EMR systems."

Their proposed fix for the no-locus problem is "text-overlay or symbolic mapping methods, potentially leveraging ontological networks", which is exactly the direction §2.4 below takes.

### 2.2 The resource landscape, with exact licences

Redistribution means: can an MIT repository ship this as a file?

| Resource | What it maps | Licence | Ship in an MIT repo? |
|---|---|---|---|
| **WHO ICD-10** | the codes themselves | WHO copyright, individually negotiated licences, geo-restricted national sub-licences, no sub-licensing | **No** |
| **ICD-10-CM** (NCHS/CMS) | the codes themselves | No licence text, no click-through, no fee on either the CDC or CMS download page. US federal work under WHO authorisation | **Yes, de facto.** Flag: neither agency publishes an explicit public-domain declaration |
| **ICD-10-GM** (BfArM) | the codes themselves | Free download, but "with the download of files a contract of use between you and the BfArM comes into being" | **No**, not without the BfArM agreement |
| **ICD-11** | stem codes plus an anatomy postcoordination axis (Chapter X extension codes) | CC BY-ND 3.0 IGO, and the licence **explicitly excludes mappings**: "Mapping or producing crosswalks between other classifications and terminologies ... are not covered by the Classifications License and are subject to a separate written agreement from WHO" | **No** for any derived mapping table |
| **SNOMED CT** finding-site (363698007) | disorder → body structure, order of 10^5 concepts | Member or affiliate licence. **Switzerland is a member since January 2016 via eHealth Suisse** | **No.** Usable server-side, not redistributable |
| **SNOMED GPS / IPS Free Set** | concept list only | GPS is **CC BY-ND 4.0** and "does not include SNOMED CT's relationships, hierarchies and remaining descriptions" | Licence permits verbatim redistribution, but **no relationships means no finding-site, so it is useless here** |
| **NLM SNOMED to ICD-10-CM map, I-MAGIC** | SNOMED → ICD-10-CM, rule-based | UMLS licence, requires both underlying licences | **No.** Server-side by a licensee only |
| **Disease Ontology** | DOID → ICD-10-CM xrefs, plus `RO:0004026 disease has location` → UBERON | **CC0 1.0** | **Yes.** The backbone |
| **MONDO** | MONDO → ICD-10-CM, ICD-11 foundation, SNOMED xrefs, plus `disease_has_location` | **CC BY 4.0** | **Yes**, with attribution |
| **Wikidata** P927 anatomical location, P494 ICD-10, P1554 UBERON | disease → anatomy | **CC0** | Yes on licence, but weak on quality: P927 is community-edited and unreviewed, mixes granularities (organ, region, cell type), and the P927 to P1554 chain is lossy because many anatomy targets carry no UBERON ID. **Coverage was not measured**, so treat it as gap-filler evidence during curation rather than a backbone. Verify with a SPARQL count at https://query.wikidata.org/ before relying on it |
| **HPO** | phenotype → UBERON via logical definitions | custom free licence with a no-alteration clause | Yes-ish, but **the wrong tool**: getting from a diagnosis to anatomy needs two lossy hops through OMIM/Orphanet-keyed annotations |
| **OHDSI ATHENA** | bundles ICD-10 and SNOMED into OMOP | per-vocabulary licences pass through; downloads are per-user | **No** |
| **Orphanet / ORDO** | rare disease ↔ ICD-10 and ICD-11 xrefs | CC BY 4.0 | Yes, but **no anatomy axis**. Marginal here |

**The two traps in that table.** ICD-11 looks like the modern answer and its anatomy postcoordination axis is genuinely well designed, but its licence explicitly carves out mappings, which is precisely what you would be building. And SNOMED's finding-site is by far the richest source and the one a Swiss organisation can legally *use*, but not ship, which forces it behind a server if you want it at all.

### 2.3 Measured coverage of the open options

Computed locally from the ontology files, downloaded 7 August 2026. **The Disease Ontology figures below were computed twice, independently [M].** The two headline figures agree closely: propagated coverage within 0.6 per cent and the distinct-ICD-code count within 0.9 per cent. The direct-anchor count differs more, by about 5.7 per cent (1,325 versus 1,400), and the reason is axiom-form handling: a simple parser catches `subClassOf/Restriction` and `equivalentClass//Restriction` but can miss restrictions nested inside `owl:intersectionOf`, which affects the direct count most and washes out after propagation.

| Metric | Disease Ontology **[M]** | MONDO **[?]** |
|---|---|---|
| Non-obsolete classes | 12,247 | 32,102 |
| Direct UBERON anchors | 1,325 to 1,400 classes | 766 classes |
| With a locus after is_a propagation | **9,298 (76%)** | 17,775 (55%) |
| Carrying an ICD-10-CM xref | 3,563 classes, 2,479 distinct codes | 2,089 classes, 2,086 distinct codes |
| **Both: distinct ICD-10-CM codes resolvable to UBERON** | **1,948 to 1,965** | 1,768 |

MONDO's figures come from a single subagent run and were not independently recomputed, hence the **[?]**. MONDO's genuine advantages over DO are 4,637 ICD-11 foundation xrefs and far deeper rare-disease coverage; its ICD-10 surface is no better, and its ICD10WHO xrefs are nearly absent at 205.

**Spot checks, independently reproduced [M]:**

| ICD-10 | Resolves to | Comment |
|---|---|---|
| J45 asthma | UBERON:0002185 bronchus, UBERON:0002186 bronchiole | good |
| K37 appendicitis | UBERON:0001154 vermiform appendix | good |
| **I21 myocardial infarction** | **UBERON:0001621 coronary artery** | **not myocardium.** The locus is inherited from the coronary-artery-disease branch. This is the granularity problem in one line |
| G43 migraine | brain, central nervous system | coarse but defensible |
| **F20 schizophrenia** | **nothing** | correct behaviour, not a bug |
| **F32 depressive episode** | **nothing** | correct behaviour, not a bug |

### 2.4 The recommended pipeline

**Ship the Disease Ontology route as the redistributable core, add a small clinician-reviewed override layer, and keep SNOMED as an optional server-side enhancer that never enters the repository.**

1. **Build step, regenerable and in-repo.** Parse `doid.owl` (CC0), extract `RO:0004026` anchors, propagate down `is_a`, join `xref: ICD10CM`, emit `icd10cm_prefix → [UBERON CURIEs]` with the source DOID as provenance. Use **nearest-anchor-wins**, taking loci from the closest ancestor only, rather than the union over all ancestors: that is what stops a myocardial infarction from inheriting the whole cardiovascular system. Match incoming codes by 3-to-4-character category prefix, which is what makes an ICD-10-CM-keyed table usable against ICD-10-GM and WHO ICD-10 inputs, since all national modifications must conform to the WHO category structure. **Never vendor WHO or GM code titles**; store the bare codes a user already has plus DO's own CC0 labels.
2. **Override layer.** A small MIT-licensed YAML keyed by ICD-10 category range, holding clinician-reviewed corrections. Budget 100 to 200 entries. This is the PMC12524217 approach done properly, which is to say published. First entry: I21 → UBERON:0002349 myocardium.
3. **No-locus policy.** F-chapter, much of E70-E90, R-codes and Z-codes have no anatomical locus and the ontology correctly returns nothing. Render them as a non-anatomical list or badge, never as a faked location. This is the paper's own suggested direction and it is right.
4. **Mesh resolution.** UBERON CURIE into the viewer's existing resolver. Where FMA is needed, bridge through UBERON's FMA xrefs (UBERON is CC BY 3.0). Use `BFO:0000050 part_of` closure to fall back to the smallest ancestor structure that actually has a mesh, which matters because the atlases do not have geometry for every term.
5. **Optional server-side, for a Swiss deployment.** ICD-10-CM → SNOMED (NLM map under UMLS, or the OMOP mappings) → finding-site → SCTID-to-UBERON xref → the same CURIE interface. Legal to run under a Swiss affiliate licence plus UMLS, not legal to ship. Keep it behind an API so the MIT repo contains zero SNOMED content.

**Expected end state:** roughly 1,950 ICD-10 categories with defensible loci out of the box, covering the large majority of diagnoses that appear in real problem lists, plus explicit and honest handling of the ones that have no location. Every layer is CC0, CC BY or MIT, and regenerable, which is the difference from the unpublished registry in the paper.

### 2.5 Prior art on diagnoses projected onto bodies

| System | What it is | Takeaway |
|---|---|---|
| **BioDigital with eClinicalWorks** (2017, production) | Interactive 3D body for charting dermatology findings inside an EHR. Their claim: mapping data onto a body "saves clinicians time, while also increasing the precision of clinical annotations compared to standard electronic forms" | The commercial proof that the pattern works in production, not just in a usability study |
| **EBI Expression Atlas anatomogram** https://github.com/ebi-gene-expression-group/anatomogram | React and SVG body maps whose regions are keyed by **UBERON and EFO IDs**. Code Apache-2.0, images CC BY 4.0 | **The strongest open engineering precedent.** Not diagnoses, but exactly the "ontology CURIE to highlightable region" architecture, already open source |
| **Jin 2016**, University of Ottawa thesis | 2D clickable body as EMR navigation. ICD codes displayed, but symptom markers are **user-placed**, not auto-mapped. Informal evaluation only | Shows the pattern predates the 3D version, and that nobody solved the mapping |
| **Symptom-checker body avatars** (WebMD, Infermedica/Symptomate) | SVG body with parts mapped to symptom IDs. Usability testing found body-pointing "an easy and intuitive way to add symptoms" | The consumer-facing version of the same interaction, and evidence it is learnable |
| **AnamneVis**, IEEE VAHC 2011 | Radial visualisation of symptom-to-diagnosis-to-treatment chains | **[?]** Full text not retrievable; characterised from the abstract only |
| US patent application 2024/0062857 | "Systems and methods for visualization of medical records", body-map EHR claims | A signal that this space is being fenced commercially |

---

## 3. Parametric body models

Full comparison in `RESEARCH.md` §2.1, integration detail in `MODEL_INTEGRATION.md`.

| Source | Licence | Why it matters |
|---|---|---|
| **ANNY** https://github.com/naver/anny · arXiv:2511.03589 | Apache-2.0 code, CC0 assets, Apache-2.0 SOMA data | The only permissive parametric body with documented infant-to-elder coverage. 13,718 verts default, 615 in the smallest decimation **[M]** |
| **MHR** https://github.com/facebookresearch/MHR · arXiv:2511.15586 | Apache-2.0 including assets from v1.0.1 | 127-joint anatomically-motivated skeleton, 7 LODs, 117 blendshape channels, no textures **[M]** |
| **SOMA-X** https://github.com/NVlabs/SOMA-X | Apache-2.0 | A retargeting layer, not an asset. Ships no viewer-loadable mesh **[M]** |
| **MakeHuman / MPFB2** https://github.com/makehumancommunity/mpfb2 | MakeHuman code **AGPL-3.0**, MPFB2 code **GPL-3.0**, both in a file named `LICENSE.CODE.md`; **assets CC0-1.0** in both | Origin of ANNY's shape space. The FAQ explicitly permits building your own generator under any licence. The shared filename carrying two different licences is an easy mistake to make |
| **SMPL family** (SMPL, SMPL-X, STAR, SUPR, SMIL, SKEL) | non-commercial, **and non-redistributable** | Disqualified. The blocker is the redistribution clause, not the NC clause: serving weights to a browser is distribution. Plus US10395411B2 and Meshcapade's exclusive commercial sublicensing |
| `vchoutas/smplx` https://github.com/vchoutas/smplx/blob/main/LICENSE | **non-commercial, on the code repo** | The contamination vector. Most downstream work imports this without noticing |

---

## 4. Anatomical data, imaging and phantoms

| Source | Licence | Note |
|---|---|---|
| **TotalSegmentator** dataset https://zenodo.org/records/10047292 · code https://github.com/wasserth/TotalSegmentator | **CC BY 4.0** data, **Apache-2.0** code | 1,228 CT subjects, 117 classes. The best open foundation in this space. **Trap: the "starred" tasks need a separate commercial licence** |
| **Visible Human Project** https://www.nlm.nih.gov/research/visible/getting_data.html | **No licence agreement since July 2019**, NLM Terms and Conditions only | The inverted assumption. Commercial use permitted. Obligations: attribution, non-endorsement, and an unusual ongoing currency notice |
| **AbdomenAtlas / BodyMaps** https://malonecenter.jhu.edu/projects/bodymaps/ | **CC BY-NC-SA 4.0** | Research only |
| **SuPreM** weights | **CC BY-NC-ND 4.0**, patents pending | ND arguably blocks fine-tuning |
| **BodyParts3D** https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html | **CC BY 4.0** since 2025-02-27, not the CC BY-SA 2.1 Japan most secondary pages still show | Organ models are named by organ ID, so the geometry-to-semantics join is nearly free. **DBCLS ships `.obj`**; the `FMA<ID>.stl` naming comes from a third-party mirror. IDs start with `FMA` only where an FMA equivalent exists, otherwise `BP`. Attribution required verbatim. Caveat: DBCLS have not confirmed the relicence in writing |
| **Z-Anatomy** https://github.com/Z-Anatomy/Models-of-human-anatomy | CC BY-SA 4.0 on GitHub, **CC BY 4.0 on Zenodo** | Unresolved conflict, needing legal review rather than a web search. On the upstream question, mind the dates: BodyParts3D is CC BY 4.0 **since 2025-02-27**, but the Z-Anatomy corpus that exists was deposited in 2021 and so derived from the CC BY-SA 2.1 Japan version. A fresh derivation from BodyParts3D is permissive; the existing Z-Anatomy corpus is not cleaned retroactively. See `RESEARCH.md` §3.5 |
| **Medical Segmentation Decathlon** http://medicaldecathlon.com/ | CC BY-SA 4.0 | ShareAlike is viral into derived label sets |
| **FLARE22** https://zenodo.org/records/7860267 | CC BY 4.0 | Derived from MSD (CC BY-SA), so the relicensing chain is arguably inconsistent |
| **autoPET** | imaging now under **NIH Controlled Data Access** | Status changed. Still widely cited as CC BY 4.0 |
| **BTCV** | Synapse DUA-gated | Ubiquitous in papers, not a public CC dataset |
| **IT'IS Virtual Population**, **XCAT**, **ICRP** and **UF/NCI** phantoms | no public terms; commercial or contact-us | All four required "contact us". Assume closed |
| **TCIA** https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/ | per-collection, **no licence column and no filter** | Never treat "it is on TCIA" as "it is CC BY" |
| **NiiVue** https://github.com/niivue/niivue | BSD-2 | 30+ volume and mesh formats. **No WebXR support documented** |
| **Cornerstone3D** https://github.com/cornerstonejs/cornerstone3D | MIT | Powers OHIF. The DICOM-centric choice |

---

## 5. Ontologies and identifiers

| System | Licence | Redistribute | Derivatives |
|---|---|---|---|
| **FMA** https://github.com/uw-sig/FMA/blob/main/LICENSE | **CC BY 4.0** | Yes | Yes |
| **UBERON** https://obofoundry.org/ontology/uberon.html | **CC BY 3.0** | Yes | Yes |
| **Disease Ontology** https://disease-ontology.org/ | **CC0 1.0** | Yes | Yes |
| **MONDO** https://mondo.monarchinitiative.org/ | **CC BY 4.0** | Yes | Yes |
| **RadLex** | RadLex v2.1, royalty-free | Yes | Yes, but RIDs, names, synonyms and relations must not be altered |
| **Orphanet / ORDO** https://www.orphadata.com/orphanet-scientific-knowledge-files/ | CC BY 4.0 | Yes | Yes |
| **SNOMED CT** full https://www.snomed.org/get-snomed | member or paid affiliate | No | No |
| **SNOMED GPS** https://www.snomed.org/gps | **CC BY-ND 4.0** | Verbatim only | **No** |
| **Terminologia Anatomica TA2** https://libraries.dal.ca/Fipat/ta2.html | **CC BY-ND 4.0** | Unaltered PDF only | **No** |
| **LOINC** https://loinc.org/license/ · **UCUM** https://ucum.org/license | free, **not OSI-open** | Yes with notice | No |

**The recommendation stands:** FMA as the primary anatomical key because the meshes are already named for it, UBERON as the required cross-reference and bridge, DO as the disease-to-anatomy layer, everything ND kept out of the core repo. **Do not invent your own IDs.**

**Two sleeper traps.** SNOMED GPS being ND defeats mapping-table use, because a mapping table is a derivative. TA2 being ND makes a machine-readable TA2 table legally uncertain, and that is exactly the file Z-Anatomy ships.

---

## 6. Product and UX

| Source | Takeaway |
|---|---|
| **BioDigital pricing** https://pricing.biodigital.com/ · **May 2026 changes** https://support.biodigital.com/hc/en-us/articles/39657133675927-May-2026-Changes-to-Individual-Plans-and-Free-Trials | The free tier was cut to A&P only, 10 views per month, 5 saves, no self-service org trials |
| **BioDigital developer intro** https://developer.biodigital.com/pages/documentation/1/getting-started/intro.html | The iframe embed contract and the `ui-*` chrome flags. The full reference is login-gated |
| **BioDigital engineering talk** http://tsherif.github.io/upenn-biodigital/ | Their own account of the architecture, and the note that some mobile GPUs cap at 8 texture units |
| **Human Studio** https://www.biodigital.com/product/human-studio | The authoring loop: hide, fade, paint, label, virtual tours, quizzes. The under-appreciated part of their moat |
| **BioDigital VR interaction guide** https://support.biodigital.com/hc/en-us/articles/23146768396311-How-to-interact-in-BioDigital-VR | Bimanual scale, five explicit modes, a hardware button to banish the panel, and **no locomotion** |
| **Open Anatomy Browser** https://www.frontiersin.org/journals/neuroinformatics/articles/10.3389/fninf.2017.00022/full | JSON-LD atlas format, UUID-keyed immutable state, URL-restorable sessions, live shared views. **The architecture to copy**, and under-maintained enough that the design is available |
| **BodyParts3D / Anatomography** https://lifesciencedb.jp/bp3d/?lng=en | One canonical URL per FMA ID, and clip-plane coordinates as URL-addressable state. A 2009 design still ahead of the field |
| **3D Organon** https://www.3dorganon.com/ | Guest mode: two hours unrestricted, then degrade. A far better first-run pattern than a monthly view counter |
| **Medicalholodeck** https://www.medicalholodeck.com/ | **RecordXR**, recording an XR session as a shareable artefact. The XR analogue of a permalink, and almost nobody does it |
| **Zygote Body** https://www.zygotebody.com/ | The opacity slider as primary navigation. Cheapest high-impact interaction in the field |
| **WebXR startup and shutdown** https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Startup_and_shutdown | Secure context, transient activation, and the `xr-spatial-tracking` permission policy that makes embeds fail silently |
| **Hand tracking vs controllers RCT** https://link.springer.com/article/10.1007/s10055-026-01333-2 | n=30, no significant difference in interaction time on most tasks. Hand tracking is an exploration and comfort win, not a performance one |
| **3D model accessibility** https://scottvinkle.com/blogs/work/3d-model-accessibility | The practical ARIA pattern set. Note **iOS ignores canvas elements entirely** for VoiceOver, which forces a DOM fallback |
| **VR anatomy meta-analysis** https://pubmed.ncbi.nlm.nih.gov/39300601/ | 24 RCTs. VR **SMD 0.58**, AR **no significant effect (p = 0.90)**, **I² 87.44%** with no identified moderators. Publish all three numbers, not just the first |

---

## 7. Health interpretation and LLM agents

| Source | Takeaway |
|---|---|
| **PHIA** *Nature Communications* 2026, 17:1143 https://www.nature.com/articles/s41467-025-67922-y · code https://github.com/yahskapar/personal-health-insights-agent | ReAct plus a pandas sandbox plus open-web search. **22% to 74% accuracy jump** when arithmetic leaves the model. Code and benchmarks are **CC BY-NC 4.0**, incompatible with MIT. Its own Limitations section (§7) states: *"we did not employ health experts to assess the domain-specific validity of PHIA's recommendations"* and *"We make no claim as to the effectiveness of these insights for helping real users understand their data, facilitating behavior changes, and ultimately improving health outcomes."* |
| **Fitbit Personal Health Coach** https://research.google/blog/how-we-are-building-the-personal-health-coach/ | Three-agent orchestration, and **over 100,000 hours** of human evaluation. Calibrate ambition against this: a non-profit cannot compete on evaluation volume, only on architecture and provenance |
| **Oura evaluation methodology** https://ouraring.com/blog/how-oura-evaluates-generative-ai-to-earn-trust/ | The closest usable template. Five dimensions, clinician-in-the-loop scenario definition **before** build, and the non-negotiable nobody else names: **avoid unsafe reassurance** |
| **Sycophancy in medical LLMs** https://doi.org/10.1038/s41746-025-02008-z | GPT-4o and GPT-4 complied with a medication-misinformation request **100% of the time (50/50)** at baseline. Prompt guards reached 94%, which is not good enough for a vulnerable user |
| **Citation fabrication** https://pmc.ncbi.nlm.nih.gov/articles/PMC12658395/ | **19.9% of citations fabricated** across 176; of the 141 non-fabricated citations, **45.4% (64 of 141) contained errors**, most often a wrong DOI. This is why the model must never write a citation string |
| **Open Wearables** https://github.com/the-momentum/open-wearables | MIT, self-hosted normalisation for Oura, Whoop, Apple Health and others, with open scoring. Its AI insight layer is advertised but **marked coming-soon**, which is exactly the gap |
| **openCHA** https://github.com/Institute4FutureHealth/CHA | MIT conversational health agent framework. Good reference architecture, research-grade implementation, **no documented safety guardrails** |

---

## 8. Regulatory

| Source | What it settles |
|---|---|
| **MDR 2017/745 Recital 19** https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017R0745 | Software "intended for life-style and well-being purposes is not a medical device". Qualification follows **your stated intended purpose** |
| **MDCG 2019-11 Rev.1** (17 June 2025) https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf | §3.1 confirms wellness and fitness apps do not qualify. **Rule 11, second paragraph**, "software intended to monitor physiological processes", is Class IIa and is the live landmine. Note the sub-labels 11a, 11b and 11c come from this guidance, not from the Regulation, whose Annex VIII Rule 11 is a single rule with unlabelled paragraphs |
| **AI Act Article 6** https://artificialintelligenceact.eu/article/6/ | An AI system inside an Annex I product needing third-party conformity assessment is **automatically high-risk**. MDR Class IIa therefore compounds |
| **AI Act Recital 18** https://artificialintelligenceact.eu/recital/18/ | Emotion recognition is Annex III high-risk, but **"physical states, such as pain or fatigue" are explicitly excluded**. This is the free win: say physiological load, not stress |
| **AI Act Article 50** https://artificialintelligenceact.eu/article/50/ | Transparency binds **2 August 2026** regardless of risk tier, and the Digital Omnibus did not move it. The Omnibus is settled: published as **Regulation (EU) 2026/1744** in the Official Journal on 24 July 2026, in force 27 July 2026, deferring Annex III high-risk to 2 December 2027 and Annex I to 2 August 2028. Note Art. 50(**2**) as well as 50(1): synthetic text must be machine-readably marked, which is a data-format obligation, not a UI badge |
| **FDA General Wellness** (final, reissued 6 Jan 2026) https://www.fda.gov/media/90652/download | The permitted grammar: **"may help to reduce the risk of X"** and **"may help living well with X"** (the word "to" is part of the blessed construction, not optional) |
| **FDA Clinical Decision Support** (final, 6 Jan 2026) https://www.fda.gov/media/191560/download | Criteria 3 and 4 are **HCP-facing**, so a consumer tool cannot use the non-device CDS pathway. General Wellness is the only US route |
| **Swiss MepV / MedDO SR 812.213** https://www.fedlex.admin.ch/eli/cc/2020/552/en · Swissmedic https://www.swissmedic.ch/swissmedic/en/home/medical-devices/regulation-of-medical-devices/neue-eu-verordnungen-mdr-ivdr.html | Near-copy of MDR including Rule 11. The MRA medical-devices chapter has been lapsed since 26 May 2021, so Switzerland is a third country. **[?]** No Swissmedic software-qualification factsheet appears to exist; they answer enquiries directly |
| **Art. 29 WP letter on health data in apps** (5 Feb 2015) https://ec.europa.eu/justice/article-29/documentation/other-document/files/2015/20150205_letter_art29wp_ec_health_data_after_plenary_annex_en.pdf | Data become health data when "conclusions are drawn ... **irrespective of whether these conclusions are accurate or inaccurate**". The moment you emit an inference you are in Article 9 |
| **revFADP SR 235.1** https://www.fedlex.admin.ch/eli/cc/2022/491/en | Swiss "high-risk profiling" has no GDPR equivalent and requires express consent. **[?]** Article numbers came from a secondary guide; fedlex is JS-gated |

---

## 9. Evidence, behaviour change and harms

| Source | Takeaway |
|---|---|
| **GRADE** https://www.gradeworkinggroup.org/ | Four certainty levels, and certainty is **orthogonal to** strength of recommendation. Show both |
| **USPSTF grade definitions** https://www.uspreventiveservicestaskforce.org/uspstf/about-uspstf/methods-and-processes/grade-definitions | The **I statement** for insufficient evidence is the model for an honest "we do not know" state |
| **BCT Ontology (BCIO)** https://github.com/HumanBehaviourChangeProject/ontologies | **CC BY 4.0 OWL.** The cleanest structured behaviour-change resource that exists. Use BCTO IRIs as the technique field |
| **COM-B** https://doi.org/10.1186/1748-5908-6-42 | A viewer can supply Capability and Motivation. It cannot supply **Opportunity**, and proposals requiring unverifiable Opportunity are the main source of unactionable output |
| **Mair et al. umbrella review** https://doi.org/10.1093/abm/kaad041 | 85 systematic reviews. Consistently effective: **credible source**, social support, prompts, self-monitoring, feedback, goal setting, action planning, graded tasks. Your citation requirement is an active ingredient, not just compliance |
| **Lee and Park meta-analysis** https://doi.org/10.1038/s41746-025-01827-4 | **SMD 0.324** across 18 RCTs, and **"the number of BCTs included in an intervention did not predict greater effectiveness"**. Cap live proposals at one or two |
| **GLIA** https://doi.org/10.1186/1472-6947-5-23 | Decidability plus executability is the cleanest operational definition of actionability, and it maps straight onto a schema |
| **Rosman et al.**, DOI 10.1161/JAHA.123.033750 | 172 AF patients: **roughly 1 in 5 wearable users** reported intense fear and anxiety in response to notifications |
| **Moody et al.** https://doi.org/10.1002/erv.70006 | 27 studies, N = 10,584. Observational associations with disordered eating **r = 0.24 to 0.49**, stronger in females. App-use correlations are numerically higher than wearable-use ones, but **the review draws no formal app-versus-wearable comparison and does not stratify for that contrast**, so treat it as a numeric observation rather than a finding. Experimental studies found no significant association, and direction is unestablished. The precautionary case for a rendered 3D body stands on the association alone and does not need the contrast |

---

## 10. Grounding corpora

Almost every source people assume is open is not.

| Source | Licence | Verdict |
|---|---|---|
| **US HHS Physical Activity Guidelines** https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines | US federal, **public domain** | The cleanest licence available. Use as the activity backbone |
| **MedlinePlus Web Service** https://medlineplus.gov/about/developers/webservices/ | free, no registration, attribute, **no logo**, 85 req/min | Best openly-usable lay-language content with a real API. Underrated |
| **PMC Open Access Subset** https://pmc.ncbi.nlm.nih.gov/tools/openftlist/ | three tiers; restrict to **Commercial Use Allowed** | All of PMC is free to read; **only the OA Subset is reusable** |
| **WHO** https://www.who.int/about/policies/publishing/copyright | **CC BY-NC-SA 3.0 IGO** | NC-SA is viral. Keep in a separately licensed data package |
| **USPSTF** https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/copyright-notice | **AHRQ copyright, not public domain** | The most mis-assumed source in this list. Also US-population-specific |
| **NICE** https://www.nice.org.uk/terms-and-conditions | **UK Open Content Licence, United Kingdom only** | **Exclude entirely.** Free to read is not open |
| **Cochrane** https://www.cochranelibrary.com/help/permissions | per-review, standard data licence non-commercial, **explicitly bans AI use** without Wiley's permission | The best lay evidence text in existence and a direct problem for an LLM system |

---

## 11. Positioning and ecosystem

| Source | Why |
|---|---|
| **EDITH CSA roadmap**, DOI 10.5281/zenodo.14769224 · https://www.edith-csa.eu/roadmap/ | Defines the Virtual Human Twin and plans a federated repository of twins. Concluded October 2025 from 800+ stakeholders. **Align the metadata schema with this early**; it is the most likely EU interoperability target and funding hook |
| **EC Virtual Human Twins** https://digital-strategy.ec.europa.eu/en/policies/virtual-human-twins | The successor policy home |
| **VPH Society** https://vph-society.org/ | 1,000+ members, 40+ institutions. VPH2026 in Milan, 1 to 4 September. Free legitimacy, and the obvious first community |
| **FDA computational modelling credibility guidance** https://www.fda.gov/media/175618/download and **ASME V&V 40** | If the project ever moves toward clinical use, context-of-use and model-risk are the expected artefacts. Put the fields in the model cards now, even empty |

**The position that follows:** OpenTwin is not a Virtual Human Twin in the EDITH sense and should not claim to be. It is **the open visualisation and interaction layer that VHT work currently lacks**. Every mechanistic twin project in Europe eventually needs to show a clinician or a patient what the model says, and currently each one builds a bespoke unshareable viewer or licenses BioDigital.

---

## 12. Uncertainty register

Carried forward so nothing here is mistaken for settled.

1. ~~AI Act Digital Omnibus deferrals depend on Official Journal publication.~~ **Resolved.** Regulation (EU) 2026/1744, Official Journal 24 July 2026, in force 27 July 2026. Article 50's 2 August 2026 date did not move.
2. **Z-Anatomy licence conflict** (CC BY-SA 4.0 on GitHub vs CC BY 4.0 on Zenodo). Legal review, not a web search. On the upstream: a **fresh** derivation from BodyParts3D is now CC BY 4.0 and carries no share-alike, but the existing Z-Anatomy corpus was deposited in 2021 and derived from the pre-relicence CC BY-SA 2.1 Japan version, so its share-alike is plausibly inherited and the 2.x to 4.0 compatibility question still applies to it. Also open: DBCLS's lack of written confirmation of the relicence, and Z-Anatomy's multi-source provenance with no per-asset manifest.
3. **MONDO coverage figures** in §2.3 come from a single subagent run and were not independently recomputed. The DO figures were.
4. **Swiss FADP article numbers** come from a secondary guide; fedlex is JS-gated.
5. **No Swissmedic software-qualification factsheet** appears to exist. Ask them directly.
6. **BioDigital's full API reference** is login-gated, so the `ui-*` parameter list and the show/hide, dissect, isolate and cross-section method names are unconfirmed.
7. **Whether BioDigital VR is native or WebXR.** Meta Store presence implies native. If they have not shipped WebXR, that is a direct opening.
8. **AbdomenAtlas 1.1Mini** returns HTTP 401. **AMOS** states no licence at all.
9. **EMA position on in-silico trials** was not verified. The FDA side is solid.
10. **TCIA per-collection licences** must be checked one collection at a time.
11. **PHIA annotator headcount** differs between the arXiv and Nature versions (19 vs 12). The 650 hours and 3-raters-per-response figures are consistent.
12. **Effect sizes and study figures** throughout §7 and §9 were fetched by subagents and not re-fetched by me.

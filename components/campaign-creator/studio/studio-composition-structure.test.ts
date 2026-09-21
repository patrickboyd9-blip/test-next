import assert from "node:assert/strict"
import { test } from "node:test"

import { LAYOUT_VARIANTS, type LeadJob, type ImageryRole } from "../../../lib/campaign-creator/types"
import { studioCompositionStructure } from "./studio-composition-structure"
import { studioCompositionTreatment } from "./studio-composition-treatment"
import { copyOfferLeads, studioCopyHierarchy } from "./studio-copy-hierarchy"

test("the five layout variants produce materially different composition structures", () => {
  const structures = LAYOUT_VARIANTS.map((layout) => studioCompositionStructure(layout))
  const signatures = structures.map((structure) =>
    JSON.stringify({
      regions: structure.regions,
      imageRelation: structure.imageRelation,
      typeRelation: structure.typeRelation,
      hasOrganizingBand: structure.hasOrganizingBand,
      imageIsGround: structure.imageIsGround,
    })
  )
  assert.equal(new Set(signatures).size, LAYOUT_VARIANTS.length)
})

test("type_primary_split is type-dominant with a supporting image", () => {
  const structure = studioCompositionStructure("type_primary_split")
  assert.deepEqual([...structure.regions], ["type", "supporting-image"])
  assert.equal(structure.typeRelation, "dominant")
  assert.equal(structure.imageRelation, "supporting")
  assert.equal(structure.hasOrganizingBand, false)
  assert.equal(structure.imageIsGround, false)
  assert.equal(structure.hasImageRegion, true)
})

test("peer_split has peer image and type regions", () => {
  const structure = studioCompositionStructure("peer_split")
  assert.deepEqual([...structure.regions], ["peer-image", "peer-type"])
  assert.equal(structure.imageRelation, "peer")
  assert.equal(structure.typeRelation, "peer")
  assert.equal(structure.hasOrganizingBand, false)
  assert.equal(structure.imageIsGround, false)
})

test("banded_split has a genuine organizing band", () => {
  const structure = studioCompositionStructure("banded_split")
  assert.equal(structure.hasOrganizingBand, true)
  assert.equal(structure.regions.includes("band"), true)
  assert.equal(structure.regions.includes("supporting"), true)
  assert.equal(structure.regions.includes("image"), true)
  assert.equal(structure.imageIsGround, false)
  assert.equal(structure.imageRelation, "secondary")
})

test("image_grounded treats the image as the visual ground", () => {
  const structure = studioCompositionStructure("image_grounded")
  assert.equal(structure.imageIsGround, true)
  assert.equal(structure.imageRelation, "ground")
  assert.equal(structure.typeRelation, "inscription")
  assert.deepEqual([...structure.regions], ["image-ground", "inscription"])
  assert.equal(structure.hasOrganizingBand, false)
})

test("type_only has no image region", () => {
  const structure = studioCompositionStructure("type_only")
  assert.equal(structure.hasImageRegion, false)
  assert.equal(structure.imageRelation, "none")
  assert.equal(structure.typeRelation, "sole")
  assert.equal(structure.regions.includes("type"), true)
  assert.equal(structure.regions.includes("field"), true)
  assert.equal(
    structure.regions.some((region) => region.includes("image")),
    false
  )
})

test("changing leadJob does not change the structural family", () => {
  const leads: LeadJob[] = ["offer", "problem", "trust", "urgency"]
  for (const layout of LAYOUT_VARIANTS) {
    const baseline = studioCompositionStructure(layout)
    for (const leadJob of leads) {
      assert.deepEqual(studioCompositionStructure(layout), baseline)
      const treatment = studioCompositionTreatment({
        leadJob,
        imageryRole: "neighborhood",
        layoutVariant: layout,
      })
      if (layout === "type_only") {
        assert.equal(treatment.photoWeight, "none")
      } else {
        assert.notEqual(treatment.photoWeight, "none")
      }
      if (layout === "peer_split") assert.equal(treatment.photoWeight, "balanced")
      if (layout === "type_primary_split") {
        assert.equal(treatment.photoWeight === "dominant", false)
      }
      if (layout === "image_grounded") {
        assert.equal(studioCompositionStructure(layout).imageIsGround, true)
      }
    }
  }
})

test("changing imageryRole does not change the structural family", () => {
  const roles: ImageryRole[] = ["consequence", "neighborhood", "crew", "logo", "none"]
  for (const layout of LAYOUT_VARIANTS) {
    const baseline = studioCompositionStructure(layout)
    for (const imageryRole of roles) {
      assert.deepEqual(studioCompositionStructure(layout), baseline)
      const treatment = studioCompositionTreatment({
        leadJob: "trust",
        imageryRole,
        layoutVariant: layout,
      })
      if (layout === "type_only") assert.equal(treatment.photoWeight, "none")
      else assert.equal(studioCompositionStructure(layout).hasImageRegion, true)
    }
  }
})

test("type_primary_split does not inherently make the offer the hero", () => {
  assert.equal(copyOfferLeads(studioCopyHierarchy(undefined)), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("offer")), true)
  assert.equal(copyOfferLeads(studioCopyHierarchy("problem")), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("trust")), false)
  assert.equal(copyOfferLeads(studioCopyHierarchy("urgency")), false)
  assert.equal(studioCompositionStructure("type_primary_split").typeRelation, "dominant")
})

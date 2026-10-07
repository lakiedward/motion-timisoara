# Club location address workflow — feature 418

The owner requested county and city dropdowns, a single address input connected to
the map, and removal of the description field on both club location routes.
The request supersedes the historical description-field criterion; it does not set
a tracker acceptance or shipping gate.

County choices cover Romania and Bucharest. City/locality choices belong to the
selected county, using the INS SIRUTA S1 2025 catalogue under CC BY 4.0.
The catalogue is available locally after the application loads. Existing names and
provider results remain selectable when their spelling differs from the catalogue.
Changing county clears the previous locality selection. These dropdowns narrow
address suggestions; choosing them alone does not invent precise map coordinates.

One editable address combobox provides suggestions. Selecting a suggestion, clicking
the map or dragging the marker populates address, locality and county above the map.
Coordinates always come from the exact selected point. Older reverse-geocoding
responses must not overwrite a later selection or a manual address edit. A point
without a resolvable street clears the previous address and explains how to complete
it. Lookup failures show retry feedback while retaining the current point.

The nullable county column is additive; existing location records remain unchanged.
An existing city can infer a county only when the catalogue match is unambiguous.
Hidden descriptions are omitted from club writes, preserving existing descriptions.
Choosing a nearby source still creates an own-club copy at its exact coordinates;
moving the marker invalidates that source selection. Existing role guards and RLS
remain the authorization boundary.

Verification covers dropdown dependency, address synchronization, missing/failed
geocoding, stale responses, exact nearby-source coordinates and save/edit persistence.
Browser checks use 1440×900, 768×1024 and 375×812. Responsive rendering is not native
device proof. Human final acceptance follows the verified preview.

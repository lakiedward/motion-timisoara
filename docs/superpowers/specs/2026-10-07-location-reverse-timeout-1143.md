# Bounded location address lookup

Bug #1143: public map clicks can remain in loading indefinitely because Photon requests have no deadline. Preserve exact selected coordinates and the existing county/address synchronization.

Bound the complete request, including body parsing. House lookup gets 3 seconds; failures or empty results fall back to the general endpoint with 5 seconds. Search gets 5 seconds and no automatic UI retries. Caller cancellation must cancel both request and fallback, while deadline failures remain visible and retryable. A stalled provider cannot guarantee an address; expose the existing retry/manual completion flow rather than fabricate one. No new provider or schema changes.

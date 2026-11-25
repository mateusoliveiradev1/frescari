import assert from "node:assert/strict";
import test from "node:test";

import {
  STOREFRONT_BIO_MAX_LENGTH,
  isAllowedStorefrontPhotoUrl,
  updateStorefrontProfileSchema,
} from "./index";

test("storefront photo must come from UploadThing over https", () => {
  assert.equal(
    isAllowedStorefrontPhotoUrl("https://abc123.ufs.sh/f/x.jpg"),
    true,
  );
  assert.equal(isAllowedStorefrontPhotoUrl("https://utfs.io/f/x.jpg"), true);
  assert.equal(isAllowedStorefrontPhotoUrl("http://utfs.io/f/x.jpg"), false);
  assert.equal(isAllowedStorefrontPhotoUrl("https://evil.com/x.jpg"), false);
  assert.equal(
    isAllowedStorefrontPhotoUrl("https://ufs.sh.evil.com/x.jpg"),
    false,
  );
  assert.equal(isAllowedStorefrontPhotoUrl("not a url"), false);
});

test("blank bio becomes null and long bio is rejected", () => {
  const parsed = updateStorefrontProfileSchema.parse({
    photoUrl: null,
    bio: "   ",
  });
  assert.equal(parsed.bio, null);

  const tooLong = updateStorefrontProfileSchema.safeParse({
    photoUrl: null,
    bio: "a".repeat(STOREFRONT_BIO_MAX_LENGTH + 1),
  });
  assert.equal(tooLong.success, false);
});

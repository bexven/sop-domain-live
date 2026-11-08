import { describe, expect, it } from "vitest";
import { canAddProduct, canAddRunningProduct, canEditResources } from "./resources";

const person = (role: string, permissions: string[] = []) => ({ role: role as never, jobRole: role, permissions });

describe("adding products", () => {
  it("lets researchers, Media Buyers and Admins add products", () => {
    expect(canAddProduct(person("RESEARCHER", ["product.create"]))).toBe(true);
    expect(canAddProduct(person("MEDIA_BUYER", ["product.addRunning"]))).toBe(true);
    expect(canAddProduct(person("ADMIN"))).toBe(true);
    expect(canAddProduct(person("VIDEO_EDITOR"))).toBe(false);
  });
  it("only people with Add running products (and Admins) add running products", () => {
    expect(canAddRunningProduct(person("MEDIA_BUYER", ["product.addRunning"]))).toBe(true);
    expect(canAddRunningProduct(person("IMAGE_DESIGNER", ["product.create", "product.addRunning"]))).toBe(true);
    expect(canAddRunningProduct(person("ADMIN"))).toBe(true);
    expect(canAddRunningProduct(person("RESEARCHER", ["product.create"]))).toBe(false);
  });
});

describe("resource links on creative tabs", () => {
  it("lets each tab's makers add links", () => {
    expect(canEditResources(person("IMAGE_DESIGNER"), "images")).toBe(true);
    expect(canEditResources(person("IMAGE_DESIGNER"), "videos")).toBe(false);
    expect(canEditResources(person("VIDEO_EDITOR"), "videos")).toBe(true);
  });
  it("lets Seniors, Media Buyers and Admins add on both", () => {
    expect(canEditResources(person("REVIEWER", ["task.review"]), "images")).toBe(true);
    expect(canEditResources(person("MEDIA_BUYER", ["campaign.manage"]), "videos")).toBe(true);
    expect(canEditResources(person("ADMIN"), "videos")).toBe(true);
    expect(canEditResources(person("CUSTOMER_SUPPORT"), "images")).toBe(false);
  });
});

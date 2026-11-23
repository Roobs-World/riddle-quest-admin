import {expect, it, jest} from "@jest/globals";
import {createFakeHostServices} from "../../../../gameplay/fixtures/fakeServices";
import {coordinateHostServices} from "../accountDeletionServiceGate";

it("routes normal host work through the shared gate and deletion through the exclusive gate", async () => {
  /** Provides services behavior. */
  const services = createFakeHostServices();
  /** Loads profile. */
  const loadProfile = jest.spyOn(services, "loadProfile");
  /** Requests purchase. */
  const requestPurchase = jest.spyOn(services, "requestPurchase");
  /** Deletes account. */
  const deleteAccount = jest.spyOn(services, "deleteAccount");
  /** Provides run behavior. */
  const run = jest.fn(async <Result>(operation: () => Promise<Result>) => operation());
  /** Provides run exclusive behavior. */
  const runExclusive = jest.fn(async (operation: () => Promise<void>) => operation());
  /** Provides coordinated behavior. */
  const coordinated = coordinateHostServices(services, {run, runExclusive});

  await coordinated.loadProfile("jest-guest");
  /** Provides product id behavior. */
  const productId = services.products[0]!.productId;
  await coordinated.requestPurchase(productId);
  await coordinated.deleteAccount();

  expect(run).toHaveBeenCalledTimes(2);
  expect(runExclusive).toHaveBeenCalledTimes(1);
  expect(loadProfile).toHaveBeenCalledWith("jest-guest");
  expect(requestPurchase).toHaveBeenCalledWith(productId);
  expect(deleteAccount).toHaveBeenCalledTimes(1);
});

it("retains loader identity across renders so pending profile refreshes keep their owner", async () => {
  /** Provider retained throughout the account visit. */
  const services = createFakeHostServices();
  /** Shared gate still checks every retained operation invocation. */
  const run = jest.fn(async <Result>(operation: () => Promise<Result>) => operation());
  /** Exclusive deletion ordering remains independent of profile reads. */
  const runExclusive = jest.fn(async (operation: () => Promise<void>) => operation());
  /** Jest authority wrapper retained through host renders. */
  const coordinated = coordinateHostServices(services, {run, runExclusive});
  /** Loader identity captured before the confirmed balance changes. */
  const refresh = coordinated.loadProfile;
  expect(coordinated.loadProfile).toBe(refresh);
  expect(coordinated.deleteAccount).toBe(coordinated.deleteAccount);
  await refresh("jest-guest");
  await coordinated.loadProfile("jest-guest");
  expect(run).toHaveBeenCalledTimes(2);
  expect(runExclusive).not.toHaveBeenCalled();
});

it("retires a cached wrapper when its underlying service changes", async () => {
  /** Provider retained throughout the account visit. */
  const services = createFakeHostServices();
  /** Gate belonging to this authority lifetime. */
  const gate = {run: async <Result>(operation: () => Promise<Result>) => operation(),
    runExclusive: async (operation: () => Promise<void>) => operation()};
  /** Jest authority wrapper retained through host renders. */
  const coordinated = coordinateHostServices(services, gate);
  /** Previous operation retained only by its original callers. */
  const original = coordinated.loadProfile;
  /** A real provider replacement must invalidate the cached identity. */
  const replacement = jest.fn<typeof services.loadProfile>(async () => null);
  services.loadProfile = replacement;
  /** Newly selected provider operation. */
  const refreshed = coordinated.loadProfile;
  expect(refreshed).not.toBe(original);
  expect(coordinated.loadProfile).toBe(refreshed);
  await refreshed("replacement-owner");
  expect(replacement).toHaveBeenCalledWith("replacement-owner");
  expect(coordinateHostServices(services, gate).loadProfile).not.toBe(refreshed);
});

it("keeps cached operations gated after the gate rejects later work", async () => {
  /** Provider retained throughout the account visit. */
  const services = createFakeHostServices();
  /** Tracks whether closed-gate calls can reach the provider. */
  const loader = jest.spyOn(services, "loadProfile");
  /** Models deletion closing the gate after an initial successful read. */
  let closed = false;
  /** Jest authority wrapper retained through host renders. */
  const coordinated = coordinateHostServices(services, {
    run: async <Result>(operation: () => Promise<Result>) => {
      if (closed) throw new Error("account gate closed");
      return operation();
    },
    runExclusive: async (operation: () => Promise<void>) => operation(),
  });
  /** Loader identity captured before the confirmed balance changes. */
  const refresh = coordinated.loadProfile;
  await refresh("jest-guest");
  closed = true;
  await expect(refresh("jest-guest")).rejects.toThrow("account gate closed");
  expect(loader).toHaveBeenCalledTimes(1);
});

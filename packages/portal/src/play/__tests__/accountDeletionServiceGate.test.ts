import {expect, it, jest} from "@jest/globals";
import {createFakeHostServices} from "../fakeServices";
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

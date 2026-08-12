import {expect, it, jest} from "@jest/globals";
import {createFakeHostServices} from "../fakeServices";
import {coordinateHostServices} from "../accountDeletionServiceGate";

it("routes normal host work through the shared gate and deletion through the exclusive gate", async () => {
  const services = createFakeHostServices();
  const loadProfile = jest.spyOn(services, "loadProfile");
  const requestPurchase = jest.spyOn(services, "requestPurchase");
  const deleteAccount = jest.spyOn(services, "deleteAccount");
  const run = jest.fn(async <Result>(operation: () => Promise<Result>) => operation());
  const runExclusive = jest.fn(async (operation: () => Promise<void>) => operation());
  const coordinated = coordinateHostServices(services, {run, runExclusive});

  await coordinated.loadProfile("jest-guest");
  const productId = services.products[0]!.productId;
  await coordinated.requestPurchase(productId);
  await coordinated.deleteAccount();

  expect(run).toHaveBeenCalledTimes(2);
  expect(runExclusive).toHaveBeenCalledTimes(1);
  expect(loadProfile).toHaveBeenCalledWith("jest-guest");
  expect(requestPurchase).toHaveBeenCalledWith(productId);
  expect(deleteAccount).toHaveBeenCalledTimes(1);
});

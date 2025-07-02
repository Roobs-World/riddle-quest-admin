// This console.log and the rest of the mock will not be reached if the above throw works.
console.log(
  "[ROOT MANUAL MOCK matter-js.js V3] This manual mock is being evaluated (after top throw)!"
);

const mockMatterEngineCreateManualV3 = jest.fn((options) => {
  throw new Error(
    "[ROOT MANUAL MOCK matter-js.js V3] Matter.Engine.create was called!"
  );
});

const MatterMock = {
  Engine: {
    create: mockMatterEngineCreateManualV3,
    run: jest.fn(),
    update: jest.fn(),
    clear: jest.fn(),
  },
  Bodies: {
    rectangle: jest.fn(() => ({ id: "mockedBodyFromRootManualMockV3" })),
  },
  Body: {
    setPosition: jest.fn(),
    setAngle: jest.fn(),
    setVelocity: jest.fn(),
    setAngularVelocity: jest.fn(),
    setStatic: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    applyForce: jest.fn(),
  },
  World: { add: jest.fn(), clear: jest.fn(), remove: jest.fn() },
  Composite: {
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    allBodies: jest.fn(() => []),
  },
  Events: { on: jest.fn(), off: jest.fn() },
  Runner: { create: jest.fn(), run: jest.fn(), stop: jest.fn() },
  Render: { create: jest.fn(), run: jest.fn() },
  MouseConstraint: { create: jest.fn() },
  Mouse: { create: jest.fn() },
  Sleeping: { set: jest.fn() },
  Vector: { create: jest.fn((x = 0, y = 0) => ({ x, y })) },
  Bounds: { create: jest.fn(), update: jest.fn() },
};

module.exports = MatterMock; // Simplified export

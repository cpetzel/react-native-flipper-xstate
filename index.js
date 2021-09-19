import { interpret } from "xstate";
import { toSCXMLEvent, toEventObject } from "xstate/lib/utils";
import { createInspectMachine } from "@xstate/inspect/lib/inspectMachine";
import { stringify } from "@xstate/inspect/lib/utils";
import { addPlugin } from "react-native-flipper";

const services = new Set();
const serviceMap = new Map();
const serviceListeners = new Set();

const logTag = "[Flipper-React-Native-Xstate]";
let loggingEnabled = false;
const log = function () {
  if (loggingEnabled) {
    console.log.apply(console, arguments);
  }
};

function createDevTools() {
  global.__xstate__ = {
    services,
    register: (service) => {
      services.add(service);
      serviceMap.set(service.sessionId, service);
      serviceListeners.forEach((listener) => listener(service));

      service.onStop(() => {
        services.delete(service);
        serviceMap.delete(service.sessionId);
      });
    },
    onRegister: (listener) => {
      serviceListeners.add(listener);
      services.forEach((service) => listener(service));

      return {
        unsubscribe: () => {
          serviceListeners.delete(listener);
        },
      };
    },
  };
}

export function inspect(options) {
  loggingEnabled = options?.debugLogging ?? false;

  createDevTools();
  const inspectService = interpret(
    createInspectMachine(global.__xstate__)
  ).start();
  let client;

  log(
    `${logTag} - Starting Xstate Inspector with dev tools`,
    global.__xstate__
  );

  const onConnect = (connection) => {
    log(`${logTag} - connection establised to flipper desktop`, connection);

    client = {
      id: "@xstate/flipper-client",
      send: (event) => {
        log(`${logTag} - sending xstate event to desktop`, event);
        connection.send("event", event);
      },
      subscribe: () => {
        return { unsubscribe: () => {} };
      },
      getSnapshot: () => undefined,
    };

    connection.send("start", {});

    connection.receive("message", (message, responder) => {
      log(`${logTag} - got message from desktop`, message);

      if (typeof message !== "object") {
        console.warn(
          `${logTag} - got a message from desktop that is not a JS object. type is == ${typeof message}`
        );
        return;
      }

      inspectService.send({
        ...message,
        client,
      });
      responder.success();
    });
  };

  const onDisconnect = () => {
    log(`${logTag} - Disconnected from Desktop`);
    //inspectService.stop();
  };

  addPlugin({
    getId() {
      return "xstate";
    },
    onConnect,
    onDisconnect,
    runInBackground() {
      return true;
    },
  });

  global.__xstate__.onRegister((service) => {
    inspectService.send({
      type: "service.register",
      machine: JSON.stringify(service.machine),
      state: JSON.stringify(service.state || service.initialState),
      id: service.id,
      sessionId: service.sessionId,
    });

    inspectService.send({
      type: "service.event",
      event: stringify((service.state || service.initialState)._event),
      sessionId: service.sessionId,
    });

    // monkey-patch service.send so that we know when an event was sent
    // to a service *before* it is processed, since other events might occur
    // while the sent one is being processed, which throws the order off
    const originalSend = service.send.bind(service);

    service.send = function inspectSend(event, payload) {
      inspectService.send({
        type: "service.event",
        event: stringify(toSCXMLEvent(toEventObject(event, payload))),
        sessionId: service.sessionId,
      });

      return originalSend(event, payload);
    };

    service.subscribe((state) => {
      inspectService.send({
        type: "service.state",
        state: stringify(state),
        sessionId: service.sessionId,
      });
    });

    service.onStop(() => {
      inspectService.send({
        type: "service.stop",
        sessionId: service.sessionId,
      });
    });

    service.subscribe((state) => {
      inspectService.send({
        type: "service.state",
        state: JSON.stringify(state),
        sessionId: service.sessionId,
      });
    });
  });

  const inspector = {
    id: "@@xstate/inspector",
    send: (event) => {
      inspectService.send(event);
    },
    subscribe: () => {
      return {
        unsubscribe: () => {},
      };
    },
    disconnect: () => {
      //server.close();
      // this is closed every time the plugin is reloaded???
      inspectService.stop();
    },
    getSnapshot: () => undefined,
  };

  return inspector;
}

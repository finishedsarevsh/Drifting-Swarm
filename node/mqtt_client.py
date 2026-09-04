"""
mqtt_client.py
Publish / subscribe wrapper around the MQTT broker (mosquitto).

Publishes ΔW packages to:   swarm/deltas/<epoch>
Subscribes to:              swarm/deltas/#

Incoming packages are queued and consumed by main.py's event loop.
"""

import json
import logging
import queue
import threading
import time
from typing import Callable, Dict, Optional

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    logging.warning("paho-mqtt not installed – MQTT disabled (offline mode)")

logger = logging.getLogger(__name__)

TOPIC_DELTAS_PREFIX = "swarm/deltas"
QOS = 1
CONNECT_TIMEOUT_S = 30
RECONNECT_DELAY_S = 5


class MQTTClient:
    """
    Wraps paho-mqtt with simple publish/subscribe helpers.

    Parameters
    ----------
    node_id    : str   – used as MQTT client_id and for filtering own messages
    mqtt_host  : str   – hostname of mosquitto broker
    mqtt_port  : int   – port (default 1883)
    on_delta   : callable(package: dict) → None, called on every incoming ΔW
    """

    def __init__(
        self,
        node_id: str,
        mqtt_host: str,
        mqtt_port: int = 1883,
        on_delta: Optional[Callable[[Dict], None]] = None,
    ):
        self.node_id = node_id
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self._on_delta = on_delta
        self._connected = False
        self._client = None
        self._incoming: queue.Queue = queue.Queue()

        if MQTT_AVAILABLE:
            self._setup_client()

    # ------------------------------------------------------------------
    def _setup_client(self):
        client_id = f"node-{self.node_id}-{int(time.time())}"
        self._client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            logger.info("[%s] MQTT connected to %s:%d", self.node_id, self.mqtt_host, self.mqtt_port)
            topic = f"{TOPIC_DELTAS_PREFIX}/#"
            client.subscribe(topic, qos=QOS)
            logger.info("[%s] Subscribed to %s", self.node_id, topic)
        else:
            logger.error("[%s] MQTT connect failed (rc=%d)", self.node_id, rc)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            logger.warning("[%s] MQTT unexpected disconnect (rc=%d) – will reconnect", self.node_id, rc)

    def _on_message(self, client, userdata, msg):
        try:
            package = json.loads(msg.payload.decode("utf-8"))
            sender = package.get("node_id", "")
            if sender == self.node_id:
                return  # ignore own messages
            logger.info("[%s] Received ΔW from %s on %s", self.node_id, sender, msg.topic)
            self._incoming.put(package)
            if self._on_delta:
                self._on_delta(package)
        except Exception as exc:
            logger.error("[%s] Failed to parse incoming MQTT message: %s", self.node_id, exc)

    # ------------------------------------------------------------------
    def connect(self) -> bool:
        """Connect to broker and start background loop. Returns True on success."""
        if not MQTT_AVAILABLE:
            logger.warning("[%s] MQTT unavailable – running in offline mode", self.node_id)
            return False
        try:
            self._client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
            self._client.loop_start()
            # Wait for connection
            deadline = time.time() + CONNECT_TIMEOUT_S
            while not self._connected and time.time() < deadline:
                time.sleep(0.1)
            return self._connected
        except Exception as exc:
            logger.error("[%s] MQTT connect error: %s", self.node_id, exc)
            return False

    def disconnect(self):
        if self._client and MQTT_AVAILABLE:
            self._client.loop_stop()
            self._client.disconnect()
        self._connected = False

    # ------------------------------------------------------------------
    def publish_delta(self, epoch: str, package: Dict) -> bool:
        """Publish a ΔW package to swarm/deltas/<epoch>."""
        if not MQTT_AVAILABLE or not self._connected:
            logger.warning("[%s] MQTT not connected – delta NOT published", self.node_id)
            return False

        topic = f"{TOPIC_DELTAS_PREFIX}/{epoch}"
        payload = json.dumps(package)
        info = self._client.publish(topic, payload, qos=QOS)
        info.wait_for_publish(timeout=10)
        ok = info.is_published()
        if ok:
            logger.info("[%s] ΔW published → %s (%d bytes)", self.node_id, topic, len(payload))
        else:
            logger.error("[%s] Failed to publish ΔW to %s", self.node_id, topic)
        return ok

    # ------------------------------------------------------------------
    def get_pending_deltas(self, block: bool = False, timeout: float = 0.1) -> list:
        """
        Drain the incoming queue and return a list of pending ΔW packages.
        Non-blocking by default.
        """
        results = []
        try:
            while True:
                pkg = self._incoming.get(block=block, timeout=timeout)
                results.append(pkg)
                block = False  # only block on first call
        except queue.Empty:
            pass
        return results

    @property
    def is_connected(self) -> bool:
        return self._connected

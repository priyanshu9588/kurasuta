"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cluster = void 0;
const cluster_1 = __importDefault(require("cluster"));
const Constants_1 = require("../Util/Constants");
const discord_js_1 = require("discord.js");
const Util = __importStar(require("../Util/Util"));
const events_1 = require("events");
class Cluster extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.ready = false;
        this.id = options.id;
        this.shards = options.shards;
        this.manager = options.manager;
        this._exitListenerFunction = this._exitListener.bind(this);
        this.once('ready', () => { this.ready = true; });
    }
    async eval(script) {
        script = typeof script === 'function' ? `(${script})(this)` : script;
        const { success, d } = await this.manager.ipc.server.sendTo(`Cluster ${this.id}`, { op: Constants_1.IPCEvents.EVAL, d: script });
        if (!success)
            throw discord_js_1.Util.makeError(d);
        return d;
    }
    async fetchClientValue(prop) {
        const { success, d } = await this.manager.ipc.server.sendTo(`Cluster ${this.id}`, { op: Constants_1.IPCEvents.EVAL, d: `this.${prop}` });
        if (!success)
            throw discord_js_1.Util.makeError(d);
        return d;
    }
    kill() {
        if (this.worker) {
            this.manager.emit('debug', `Killing Cluster ${this.id}`);
            this.worker.removeListener('exit', this._exitListenerFunction);
            this.worker.kill();
        }
    }
    async respawn(delay = 500) {
        this.kill();
        if (delay)
            await Util.sleep(delay);
        await this.spawn();
    }
    send(data) {
        return this.manager.ipc.node.sendTo(`Cluster ${this.id}`, data);
    }
    async spawn() {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        this.worker = cluster_1.default.fork(Object.assign({ CLUSTER_SHARDS: this.shards.join(','), CLUSTER_ID: this.id.toString(), CLUSTER_SHARD_COUNT: this.manager.shardCount.toString(), CLUSTER_CLUSTER_COUNT: this.manager.clusterCount.toString() }, process.env));
        this.worker.once('exit', this._exitListenerFunction);
        this.manager.emit('debug', `Worker spawned with id ${this.worker.id}`);
        this.manager.emit('spawn', this);
        await this._waitReady(this.shards.length);
        await Util.sleep(5000);
    }
    _exitListener(code, signal) {
        this.ready = false;
        this.worker = undefined;
        this.manager.emit('debug', `Worker exited with code ${code} and signal ${signal}${this.manager.respawn ? ', restarting...' : ''}`);
        if (this.manager.respawn)
            return this.respawn();
    }
    _waitReady(shardCount) {
        return new Promise((resolve, reject) => {
            this.once('ready', resolve);
            setTimeout(() => reject(new Error(`Cluster ${this.id} took too long to get ready`)), (this.manager.timeout * shardCount) * (this.manager.guildsPerShard / 1000));
        });
    }
}
exports.Cluster = Cluster;

//# sourceMappingURL=Cluster.js.map

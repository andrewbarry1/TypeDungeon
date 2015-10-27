import sys, time, random
from twisted.python import log
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.twisted.websocket import WebSocketServerFactory

ids = []
clients = {}
room_occupants = {}
rooms = {}

# globals/finals
enemies = {1:['peppermonster.png','evilpenguin.png'],2:['test3.png']}
TYPO_DAMAGE = 5
ENC_MIN = 5
ENC_MAX = 10

# one in-game room (NOT lobby), and all associated game logic required to syncronize things
class Room:
    def __init__(self, room_id, protocols, uids):
        self.rid = room_id
        self.clients = {}
        for x in range(0,len(uids)):
            if not(uids[x] is None):
                self.clients[uids[x]] = protocols[x]
                self.clients[uids[x]].playing = True # redirect future onMessages to this room object
        self.uids = uids
        self.new_map_count = 0
        self.map_number = 0
        self.controller = None
        self.sync_number = 0

        # debug
        self.monsters = True
        
        # encounter-relevant variables
        self.enc_rate = 0
        self.in_encounter = False
        self.enemy_hp = None
        self.player_hp = 150
        self.typos = {}
        for u in uids:
            self.typos[u] = 0
        self.send_to_all("start")


        
    def send_to_one(self, uid, message):
        self.clients[uid].sendMessage(message)
    def send_to_all_but_one(self,exclude,message):
        for u in self.uids:
            if not(u == exclude):
                 self.clients[u].sendMessage(message)
    def send_to_all(self,message):
        for u in self.uids:
            self.clients[u].sendMessage(message)


    def revoke_control(self):
        if not(self.controller is None):
            self.send_to_one(self.controller, "revoke")
            self.controller = None
    def grant_control(self,uid):
        self.send_to_one(uid, "grant")
        self.controller = uid
            
    def request_new_map(self):
        self.new_map_count += 1
        if (self.new_map_count == len(self.clients)):
            self.map_number += 1
            self.new_map_count = 0
            self.prepare_map(self.map_number)
    def prepare_map(self,map_number):
        mapfile = open('maps/test3.map','r')
        lines = mapfile.readlines()
        for line in lines:
            self.send_to_all(line)
        mapfile.close()
        self.encounter_rate = 0
        self.do_sync(0,self.do_start_map)

    def do_start_map(self):
        self.send_to_all("done")
        self.grant_control(self.uids[0])

    def do_sync(self, sn, func):
        self.sync_func = func
        self.sync_count = 0
        self.sync_number = sn
        self.revoke_control()
        self.send_to_all('sync' + str(sn))

    def do_encounter(self):
        difficulty = self.map_number + 1
        enemy_sprite = random.choice(enemies[self.map_number])
        low_wpm = 10 + (difficulty * 20)
        high_wpm = 20 + (difficulty * 20)
        enemy_wpm = random.randrange(low_wpm, high_wpm)
        self.enemy_hp = high_wpm * 30
        self.send_to_all('esp:' + enemy_sprite)
        self.send_to_all('ewpm:' + str(enemy_wpm))
        self.send_to_all('ehp:' + str(self.enemy_hp))
        self.do_sync(2, self.start_encounter) # sync allows for img/text loading

    def do_encounter_check(self):
        if not(self.monsters): return
        self.enc_rate += random.randrange(ENC_MIN,ENC_MAX)
        if (random.randrange(100) < self.enc_rate):
            self.do_sync(1,self.do_encounter)

    def start_encounter(self):
        self.in_encounter = True
        self.send_to_all("enc")

    def on_encounter_message(self,uid,payload):
        if (payload[0] == 'w'): # general wpm
            payload_info = payload.split(',')
            if (int(payload_info[1]) >= 250): # basic anti-cheat. Nobody types 250wpm.
                return
            self.send_to_all_but_one(uid, 'w,' + str(uid) + ',' + payload_info[1])
        elif (payload[0] == 'p'): # pair wpm
            pair_wpm = int(payload.split(',')[1])
            dmg = pair_wpm - (3 * self.typos[uid])
            if (dmg <= 0): return
            self.enemy_hp -= dmg
            self.send_to_all('a,' + str(dmg))
            if (self.enemy_hp <= 0): # debug
                self.grant_control(self.uids[0])
                self.in_encounter = False
                self.enc_rate = 0
        elif (payload == 't'): # typo
            self.player_hp -= TYPO_DAMAGE
            self.typos[uid] += 1
            self.send_to_all('d,' + str(TYPO_DAMAGE))
            if (self.player_hp <= 0): # debug
                self.grant_control(self.uids[0])
                self.in_encounter = False
                self.enc_rate = 0
            

    def on_message(self,uid,payload):
        if (payload == 'STOP-MONSTERS'):
            self.monsters = False
        if (self.in_encounter):
            self.on_encounter_message(uid,payload)
            return
        if (payload == 'prepm'): # prepare map
            self.request_new_map()
        elif (payload == 'mtr' or payload == 'mtl' or payload == 'mf' or payload == 'mb'): # movement
            self.send_to_all_but_one(uid,payload)
            if (payload == 'mf' or payload == 'mb'):
                self.do_encounter_check()
        elif (payload == 'sync' + str(self.sync_number)):
            self.sync_count += 1
            if (self.sync_count == len(self.uids)):
                self.sync_func()






















            

class MyServerProtocol(WebSocketServerProtocol):

    def onMessage(self, payload, isBinary):

        if (self.playing):
            self.Room.on_message(self.uid,payload)
        elif (payload[:4] == "newr"):
            new_room = int(str(int(time.time())) + str(random.randrange(1000,9999)))
            room_occupants[new_room] = [self.uid,None,None,None]
            self.room = new_room
            self.sendMessage("newr," + str(new_room))
        elif (payload[:5] == "jroom"):
            room_to_join = int(payload.split(",")[1])
            try:
                room = room_occupants[room_to_join]
            except:
                self.sendMessage("noroom")
                return
            if room[0] is None or room[1] is None or room[2] is None or room[3] is None:
                this_room = room_occupants[room_to_join]
                for x in range(0,4):
                    if (this_room[x] is None):
                        room_occupants[room_to_join][x] = self.uid
                        break
                self.room = room_to_join
                for i in this_room:
                    if (i is None or i == self.uid):
                        self.sendMessage("newp,")
                    elif not(i == self.uid):
                        clients[i].sendMessage("join," + str(self.uid) + "," + self.name)
                        self.sendMessage("newp," + str(i) + "," + clients[i].name)
                self.sendMessage("dnp")
            else:
                self.sendMessage("full")
        elif (payload[:5] == "ready"):
            self.ready = True
            pCount = 0
            for i in room_occupants[self.room]:
                if not(i is None) and clients[i].ready: pCount += 1
            if pCount > 0:
                rooms[self.room] = Room(self.room, [clients[u] for u in room_occupants[self.room] if not(u is None)], [r for r in room_occupants[self.room] if not(r is None)])
                for c in room_occupants[self.room]:
                    if not(c is None):
                        clients[c].Room = rooms[self.room]
        elif (payload[:4] == "name"):
            self.name = payload[5:]
            

    def onOpen(self):
        self.uid = int(str(int(time.time())) + str(random.randrange(1000,9999)))
        self.room = None
        self.name = "Anonymous Typist"
        self.ready = False
        self.color = (random.randrange(0,255),random.randrange(0,255),random.randrange(0,255))
        self.sendMessage("you," + str(self.uid))
        self.playing = False
        clients[self.uid] = self
        ids.append(self.uid)

    def onClose(self, wasClean, code, reason):
        ids.remove(self.uid)
        del clients[self.uid]
        room_occupants[self.room][room_occupants[self.room].index(self.uid)] = None
        for i in room_occupants[self.room]:
            if not(i == self.uid) and not(i is None):
                clients[i].sendMessage("quit," + str(self.uid))
        deletingRoom = True
        for x in range(0,4):
            if not(room_occupants[self.room] is None):
                deletingRoom = False
        if (deletingRoom): # delete empty rooms
            del room_occupants[self.room]
            del rooms[self.room]


if __name__ == '__main__':
    factory = WebSocketServerFactory("ws://127.0.0.1:9001",debug=False)
    factory.protocol = MyServerProtocol
    reactor.listenTCP(9001,factory)
    reactor.run()

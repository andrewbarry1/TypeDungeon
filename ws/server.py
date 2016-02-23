import sys, time, random, math
from twisted.python import log
from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.twisted.websocket import WebSocketServerFactory

ids = []
clients = {}
room_occupants = {}
rooms = {}

# globals/finals
maps = {1:['house.map'],2:['test3.map'],3:['test1.map','test2.map']}
enemies = {1:['peppermonster.png','evilpenguin.png']}
ENC_MIN = 5
ENC_MAX = 10
PLAYER_MAX_HP = 150

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
        self.in_qte = False
        self.sync_number = 0
        self.map = None
        self.typo_damage = len(self.uids) * 3
        

        # debug
        self.monsters = True
        
        # encounter-relevant variables
        self.enc_rate = 0
        self.in_encounter = False
        self.enemy_hp = None
        self.player_hp = PLAYER_MAX_HP
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

    def onClose(self, quid): # user quid has quit
        self.uids.remove(quid)
        self.typo_damage = len(self.uids) * 3

    def swap_control(self): # start qte control swap
        self.revoke_control()
        qte_letter = random.choice([c for c in 'abcdefghijklmnopqrstuvwxyz0123456789'])
        self.in_qte = True
        self.send_to_all('q,' + qte_letter)
    def revoke_control(self):
        if not(self.controller is None):
            self.send_to_one(self.controller, "revoke")
            self.controller = None
    def grant_control(self,uid):
        self.send_to_all("grant," + str(uid))
        self.controller = uid
        
    def request_new_map(self):
        self.new_map_count += 1
        if (self.new_map_count == len(self.clients)):
            self.map_number += 1
            self.new_map_count = 0
            self.prepare_map(self.map_number)
            
    def prepare_map(self,map_number):
        mapfile = open('maps/' + random.choice(maps[min(len(maps),self.map_number)]),'r')
        self.map = mapfile.readlines()
        mapfile.close()
        self.send_to_all(self.map[0])
        self.send_to_all(self.map[1])
        self.send_to_all(self.map[2])
        self.do_sync(0,self.do_start_map)

    def do_start_map(self):
        self.encounter_rate = 0
        for line in self.map[3:]:
            self.send_to_all(line)
        self.encounter_rate = 0
        if len(self.uids) > 1:
            self.do_sync(3,self.swap_control)
        else:
            self.do_sync(3, self.single_grant)

    def single_grant(self):
        self.grant_control(self.uids[0])

    def do_sync(self, sn, func):
        self.sync_func = func
        self.sync_count = 0
        self.sync_number = sn
        self.revoke_control()
        self.send_to_all('sync' + str(sn))

    def do_encounter(self):
        difficulty = self.map_number + (1.2 * len(self.uids))
        enemy_sprite = random.choice(enemies[min(self.map_number,len(enemies))])
        self.enemy_hp = math.floor(difficulty * 30) * len(self.uids)
        self.send_to_all('esp:' + enemy_sprite)
        self.send_to_all('ewpm:10') # doesn't matter right now
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
        elif (payload[0] == 'p'): # pair wpm (note - no longer a pair)
            pair_wpm = int(payload.split(',')[1])
            dmg = int((pair_wpm - self.typos[uid]) / 2)
            if (dmg <= 0): return
            self.enemy_hp -= dmg
            self.send_to_all('a,' + str(dmg))
            if (self.enemy_hp <= 0): # victory
                self.player_hp = PLAYER_MAX_HP
                self.in_encounter = False
                self.enc_rate = 0
                if len(self.uids) > 1:
                    self.do_sync(3, self.swap_control)
                else:
                    self.do_sync(3, self.single_grant)
        elif (payload == 't'): # typo
            self.player_hp -= self.typo_damage
            self.typos[uid] += 1
            self.send_to_all('d,' + str(self.typo_damage))
            if (self.player_hp <= 0): # dead
                self.in_encounter = False
                self.do_sync(4, self.do_respawn)

    def do_respawn(self):
        self.enc_rate = 0
        self.player_hp = PLAYER_MAX_HP
        self.send_to_all("kill")
        if len(self.uids) > 1:
            self.do_sync(3, self.swap_control)
        else:
            self.do_sync(3, self.single_grant)
                
    def on_message(self,uid,payload):
        if (payload == 'STOP-MONSTERS'): # debug
            self.monsters = False
        if (self.in_encounter):
            self.on_encounter_message(uid,payload)
            return
        if (payload == 'prepm'): # prepare map
            self.request_new_map()
        elif (payload == 'mtr' or payload == 'mtl' or payload == 'mf' or payload == 'mb') and (uid == self.controller): # movement
            self.send_to_all_but_one(uid,payload)
            if (payload == 'mf' or payload == 'mb'):
                self.do_encounter_check()
        elif (payload == 'sync' + str(self.sync_number)): # sync methods
            self.sync_count += 1
            if (self.sync_count == len(self.uids)):
                self.sync_func()
        elif (payload == 'q' and self.in_qte): # qte response - give control
            self.in_qte = False
            self.grant_control(uid)



            

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
            try:
                room_to_join = int(payload.split(",")[1])
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
            rCount = 0
            for i in room_occupants[self.room]:
                if not(i is None):
                    pCount += 1
                    if clients[i].ready: rCount += 1
            if rCount == pCount:
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
        if (self.room is None): # no crashes in main menu
            return
        if self.playing: # ingame - use Room's onClose
            self.Room.onClose(self.uid)
        ids.remove(self.uid)
        del clients[self.uid]
        room_occupants[self.room][room_occupants[self.room].index(self.uid)] = None
        for i in room_occupants[self.room]:
            if not(i == self.uid) and not(i is None):
                clients[i].sendMessage("quit," + str(self.uid))
        deletingRoom = True
        for x in range(0,4):
            if not(room_occupants[self.room][x] is None):
                deletingRoom = False
        if (deletingRoom): # delete empty rooms
            del room_occupants[self.room]
            if (self.playing): # no crashes in lobby
                del rooms[self.room]


if __name__ == '__main__':
    factory = WebSocketServerFactory("ws://127.0.0.1:9001",debug=False)
    factory.protocol = MyServerProtocol
    reactor.listenTCP(9001,factory)
    reactor.run()

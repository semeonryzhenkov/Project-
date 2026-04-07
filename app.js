/**
 * Interior Planner - Main Application
 * A single-page web application for creating floor plans
 */

// ==================== Constants ====================
const GRID_SIZE = 20;
const WALL_THICKNESS = 4;
const SNAP_THRESHOLD = 10;
const COLORS = {
    grid: '#e8e8e8',
    wall: '#2c3e50',
    wallSelected: '#3498db',
    window: '#3498db',
    door: '#27ae60',
    roomHighlight: 'rgba(52, 152, 219, 0.1)',
    roomBorder: 'rgba(52, 152, 219, 0.3)'
};

// ==================== Data Models ====================
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    equals(other, threshold = 0.1) {
        return Math.abs(this.x - other.x) < threshold && Math.abs(this.y - other.y) < threshold;
    }
    
    distanceTo(other) {
        return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
    }
}

class Wall {
    constructor(start, end, id = null) {
        this.id = id || `wall_${Date.now()}_${Math.random()}`;
        this.start = start;
        this.end = end;
        this.type = 'wall';
    }
    
    get length() {
        return this.start.distanceTo(this.end);
    }
    
    get angle() {
        return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
    }
    
    containsPoint(point, threshold = SNAP_THRESHOLD) {
        const dist = this.pointToLineDistance(point);
        return dist <= threshold;
    }
    
    pointToLineDistance(point) {
        const A = point.x - this.start.x;
        const B = point.y - this.start.y;
        const C = this.end.x - this.start.x;
        const D = this.end.y - this.start.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = this.start.x;
            yy = this.start.y;
        } else if (param > 1) {
            xx = this.end.x;
            yy = this.end.y;
        } else {
            xx = this.start.x + param * C;
            yy = this.start.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    clone() {
        return new Wall(
            new Point(this.start.x, this.start.y),
            new Point(this.end.x, this.end.y),
            this.id
        );
    }
}

class Window {
    constructor(wallId, position, width = 60, id = null) {
        this.id = id || `window_${Date.now()}_${Math.random()}`;
        this.wallId = wallId;
        this.position = position; // 0-1 along the wall
        this.width = width;
        this.type = 'window';
    }
    
    clone() {
        return new Window(this.wallId, this.position, this.width, this.id);
    }
}

class Door {
    constructor(wallId, position, width = 70, swingDirection = 1, id = null) {
        this.id = id || `door_${Date.now()}_${Math.random()}`;
        this.wallId = wallId;
        this.position = position; // 0-1 along the wall
        this.width = width;
        this.swingDirection = swingDirection; // 1 or -1
        this.type = 'door';
    }
    
    clone() {
        return new Door(this.wallId, this.position, this.width, this.swingDirection, this.id);
    }
}

class Room {
    constructor(polygon, id = null) {
        this.id = id || `room_${Date.now()}_${Math.random()}`;
        this.polygon = polygon; // Array of Points
        this.name = '';
        this.centroid = this.calculateCentroid();
    }
    
    calculateCentroid() {
        if (this.polygon.length === 0) return new Point(0, 0);
        
        let x = 0, y = 0;
        for (const point of this.polygon) {
            x += point.x;
            y += point.y;
        }
        return new Point(x / this.polygon.length, y / this.polygon.length);
    }
    
    containsPoint(point) {
        // Ray casting algorithm
        let inside = false;
        const n = this.polygon.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = this.polygon[i].x, yi = this.polygon[i].y;
            const xj = this.polygon[j].x, yj = this.polygon[j].y;
            
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
}

// ==================== Project Manager ====================
class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentProjectId = null;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const data = localStorage.getItem('interiorPlannerProjects');
            if (data) {
                const parsed = JSON.parse(data);
                this.projects = parsed.projects || [];
                this.currentProjectId = parsed.currentProjectId;
            }
        } catch (e) {
            console.error('Failed to load projects from storage:', e);
            this.projects = [];
        }
    }
    
    saveToStorage() {
        try {
            const data = {
                projects: this.projects,
                currentProjectId: this.currentProjectId
            };
            localStorage.setItem('interiorPlannerProjects', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save projects to storage:', e);
        }
    }
    
    createProject(name) {
        const project = {
            id: `project_${Date.now()}_${Math.random()}`,
            name: name,
            walls: [],
            windows: [],
            doors: [],
            rooms: [],
            createdAt: new Date().toISOString()
        };
        this.projects.push(project);
        this.saveToStorage();
        return project;
    }
    
    getProject(id) {
        return this.projects.find(p => p.id === id);
    }
    
    getCurrentProject() {
        return this.getProject(this.currentProjectId);
    }
    
    setCurrentProject(id) {
        this.currentProjectId = id;
        this.saveToStorage();
    }
    
    updateProject(project) {
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index !== -1) {
            this.projects[index] = project;
            this.saveToStorage();
        }
    }
    
    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        if (this.currentProjectId === id) {
            this.currentProjectId = null;
        }
        this.saveToStorage();
    }
    
    duplicateProject(id) {
        const project = this.getProject(id);
        if (!project) return null;
        
        const duplicate = {
            ...project,
            id: `project_${Date.now()}_${Math.random()}`,
            name: `Копия ${project.name}`,
            walls: project.walls.map(w => ({...w})),
            windows: project.windows.map(w => ({...w})),
            doors: project.doors.map(d => ({...d})),
            rooms: project.rooms.map(r => ({...r}))
        };
        
        this.projects.push(duplicate);
        this.saveToStorage();
        return duplicate;
    }
    
    renameProject(id, newName) {
        const project = this.getProject(id);
        if (project) {
            project.name = newName;
            this.saveToStorage();
        }
    }
}

// ==================== Room Detection ====================
class RoomDetector {
    static findRooms(walls) {
        if (walls.length < 3) return [];
        
        // Build adjacency graph
        const endpoints = this.getWallEndpoints(walls);
        const connectedPoints = this.findConnectedPoints(endpoints);
        
        // Find cycles using DFS
        const cycles = this.findCycles(walls, connectedPoints);
        
        // Convert cycles to rooms
        const rooms = [];
        for (const cycle of cycles) {
            if (cycle.length >= 3) {
                const polygon = cycle.map(p => new Point(p.x, p.y));
                const room = new Room(polygon);
                rooms.push(room);
            }
        }
        
        return rooms;
    }
    
    static getWallEndpoints(walls) {
        const endpoints = [];
        for (const wall of walls) {
            endpoints.push({ point: wall.start, wallId: wall.id });
            endpoints.push({ point: wall.end, wallId: wall.id });
        }
        return endpoints;
    }
    
    static findConnectedPoints(endpoints) {
        const connected = new Map();
        
        // Group endpoints by proximity
        const clusters = this.clusterPoints(endpoints.map(e => e.point));
        
        // Create connectivity map
        for (const cluster of clusters) {
            const clusterKey = `${cluster[0].x},${cluster[0].y}`;
            connected.set(clusterKey, cluster);
        }
        
        return connected;
    }
    
    static clusterPoints(points, threshold = SNAP_THRESHOLD) {
        const clusters = [];
        const used = new Set();
        
        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue;
            
            const cluster = [points[i]];
            used.add(i);
            
            for (let j = i + 1; j < points.length; j++) {
                if (used.has(j)) continue;
                
                const dist = points[i].distanceTo(points[j]);
                if (dist <= threshold) {
                    cluster.push(points[j]);
                    used.add(j);
                }
            }
            
            // Average the cluster points
            const avg = {
                x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
                y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length
            };
            clusters.push([new Point(avg.x, avg.y)]);
        }
        
        return clusters;
    }
    
    static findCycles(walls, connectedPoints) {
        // Build graph
        const graph = new Map();
        const pointMap = new Map();
        
        // Create unique point identifiers
        let pointId = 0;
        for (const [key, cluster] of connectedPoints) {
            const avgPoint = cluster[0];
            pointMap.set(`${avgPoint.x},${avgPoint.y}`, pointId);
            graph.set(pointId, []);
            pointId++;
        }
        
        // Add edges
        for (const wall of walls) {
            const startKey = this.findClosestClusterKey(wall.start, connectedPoints);
            const endKey = this.findClosestClusterKey(wall.end, connectedPoints);
            
            if (startKey && endKey) {
                const startId = pointMap.get(startKey);
                const endId = pointMap.get(endKey);
                
                if (startId !== undefined && endId !== undefined) {
                    graph.get(startId).push(endId);
                    graph.get(endId).push(startId);
                }
            }
        }
        
        // Find all cycles using DFS
        const cycles = [];
        const visited = new Set();
        
        for (const [nodeId, neighbors] of graph) {
            if (visited.has(nodeId)) continue;
            
            const nodeCycles = this.findCyclesFromNode(graph, nodeId, visited);
            cycles.push(...nodeCycles);
        }
        
        // Filter and deduplicate cycles
        return this.filterUniqueCycles(cycles, connectedPoints);
    }
    
    static findClosestClusterKey(point, connectedPoints) {
        let closestKey = null;
        let closestDist = Infinity;
        
        for (const [key, cluster] of connectedPoints) {
            const dist = point.distanceTo(cluster[0]);
            if (dist < closestDist) {
                closestDist = dist;
                closestKey = key;
            }
        }
        
        return closestDist <= SNAP_THRESHOLD ? closestKey : null;
    }
    
    static findCyclesFromNode(graph, startNode, globalVisited) {
        const cycles = [];
        const stack = [[startNode, [startNode]]];
        
        while (stack.length > 0) {
            const [node, path] = stack.pop();
            
            for (const neighbor of graph.get(node) || []) {
                if (neighbor === startNode && path.length >= 3) {
                    cycles.push([...path]);
                } else if (!path.includes(neighbor)) {
                    stack.push([neighbor, [...path, neighbor]]);
                }
            }
        }
        
        for (const node of graph.keys()) {
            globalVisited.add(node);
        }
        
        return cycles;
    }
    
    static filterUniqueCycles(cycles, connectedPoints) {
        const unique = [];
        const seen = new Set();
        
        for (const cycle of cycles) {
            // Normalize cycle for comparison
            const normalized = this.normalizeCycle(cycle);
            const key = normalized.join('-');
            
            if (!seen.has(key)) {
                seen.add(key);
                
                // Convert back to points
                const keys = Array.from(connectedPoints.keys());
                const polygon = normalized.map(id => {
                    const key = keys[id];
                    const [x, y] = key.split(',').map(Number);
                    return new Point(x, y);
                });
                
                unique.push(polygon);
            }
        }
        
        return unique;
    }
    
    static normalizeCycle(cycle) {
        if (cycle.length === 0) return cycle;
        
        // Find minimum element and rotate
        const minIdx = cycle.indexOf(Math.min(...cycle));
        const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
        
        // Check if reverse is smaller
        const reversed = [...rotated].reverse();
        reversed.push(reversed.shift());
        
        if (reversed.join('-') < rotated.join('-')) {
            return reversed;
        }
        
        return rotated;
    }
}

// ==================== Canvas Renderer ====================
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    clear() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawGrid(showGrid = true) {
        if (!showGrid) return;
        
        this.ctx.strokeStyle = COLORS.grid;
        this.ctx.lineWidth = 1;
        
        const startX = Math.floor(-this.offsetX / this.scale / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(-this.offsetY / this.scale / GRID_SIZE) * GRID_SIZE;
        const endX = startX + Math.ceil(this.canvas.width / this.scale / GRID_SIZE) * GRID_SIZE + GRID_SIZE;
        const endY = startY + Math.ceil(this.canvas.height / this.scale / GRID_SIZE) * GRID_SIZE + GRID_SIZE;
        
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += GRID_SIZE) {
            const screenX = x * this.scale + this.offsetX;
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
            const screenY = y * this.scale + this.offsetY;
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
        }
        this.ctx.stroke();
    }
    
    worldToScreen(point) {
        return {
            x: point.x * this.scale + this.offsetX,
            y: point.y * this.scale + this.offsetY
        };
    }
    
    screenToWorld(point) {
        return {
            x: (point.x - this.offsetX) / this.scale,
            y: (point.y - this.offsetY) / this.scale
        };
    }
    
    drawWall(wall, isSelected = false) {
        const start = this.worldToScreen(wall.start);
        const end = this.worldToScreen(wall.end);
        
        this.ctx.strokeStyle = isSelected ? COLORS.wallSelected : COLORS.wall;
        this.ctx.lineWidth = WALL_THICKNESS * this.scale;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        
        // Draw endpoints
        this.ctx.fillStyle = isSelected ? COLORS.wallSelected : COLORS.wall;
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, 4 * this.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(end.x, end.y, 4 * this.scale, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawWindow(window, wall) {
        if (!wall) return;
        
        const start = this.worldToScreen(wall.start);
        const end = this.worldToScreen(wall.end);
        
        const windowStart = {
            x: start.x + (end.x - start.x) * (window.position - window.width / 2 / wall.length),
            y: start.y + (end.y - start.y) * (window.position - window.width / 2 / wall.length)
        };
        const windowEnd = {
            x: start.x + (end.x - start.x) * (window.position + window.width / 2 / wall.length),
            y: start.y + (end.y - start.y) * (window.position + window.width / 2 / wall.length)
        };
        
        this.ctx.strokeStyle = COLORS.window;
        this.ctx.lineWidth = (WALL_THICKNESS + 2) * this.scale;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(windowStart.x, windowStart.y);
        this.ctx.lineTo(windowEnd.x, windowEnd.y);
        this.ctx.stroke();
    }
    
    drawDoor(door, wall) {
        if (!wall) return;
        
        const start = this.worldToScreen(wall.start);
        const end = this.worldToScreen(wall.end);
        
        const doorPos = {
            x: start.x + (end.x - start.x) * door.position,
            y: start.y + (end.y - start.y) * door.position
        };
        
        // Draw door gap
        const halfWidth = door.width / 2 / wall.length;
        const gapStart = {
            x: start.x + (end.x - start.x) * (door.position - halfWidth),
            y: start.y + (end.y - start.y) * (door.position - halfWidth)
        };
        const gapEnd = {
            x: start.x + (end.x - start.x) * (door.position + halfWidth),
            y: start.y + (end.y - start.y) * (door.position + halfWidth)
        };
        
        this.ctx.strokeStyle = COLORS.door;
        this.ctx.lineWidth = (WALL_THICKNESS + 2) * this.scale;
        
        this.ctx.beginPath();
        this.ctx.moveTo(gapStart.x, gapStart.y);
        this.ctx.lineTo(gapEnd.x, gapEnd.y);
        this.ctx.stroke();
        
        // Draw door swing arc
        const normalAngle = wall.angle + Math.PI / 2 * door.swingDirection;
        const arcRadius = door.width / 2 * this.scale;
        const arcStart = wall.angle + (door.swingDirection > 0 ? 0 : Math.PI);
        const arcEnd = wall.angle + (door.swingDirection > 0 ? Math.PI / 2 : -Math.PI / 2);
        
        this.ctx.strokeStyle = COLORS.door;
        this.ctx.lineWidth = 1 * this.scale;
        this.ctx.setLineDash([3, 3]);
        
        this.ctx.beginPath();
        this.ctx.arc(doorPos.x, doorPos.y, arcRadius, arcStart, arcEnd, door.swingDirection < 0);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawRoom(room) {
        if (room.polygon.length < 3) return;
        
        // Fill room
        this.ctx.fillStyle = COLORS.roomHighlight;
        this.ctx.beginPath();
        const firstPoint = this.worldToScreen(room.polygon[0]);
        this.ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < room.polygon.length; i++) {
            const point = this.worldToScreen(room.polygon[i]);
            this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw border
        this.ctx.strokeStyle = COLORS.roomBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw room name
        if (room.name) {
            const centroid = this.worldToScreen(room.centroid);
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = `${14 * this.scale}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(room.name, centroid.x, centroid.y);
        }
    }
    
    drawPreviewLine(start, end) {
        const screenStart = this.worldToScreen(start);
        const screenEnd = this.worldToScreen(end);
        
        this.ctx.strokeStyle = COLORS.wall;
        this.ctx.lineWidth = WALL_THICKNESS * this.scale;
        this.ctx.setLineDash([5, 5]);
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenStart.x, screenStart.y);
        this.ctx.lineTo(screenEnd.x, screenEnd.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawSnapPoint(point) {
        const screen = this.worldToScreen(point);
        
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, 6 * this.scale, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    render(project, toolState) {
        this.clear();
        this.drawGrid(toolState.snapToGrid);
        
        // Draw rooms first (behind everything)
        if (project.rooms) {
            for (const room of project.rooms) {
                this.drawRoom(room);
            }
        }
        
        // Draw walls
        if (project.walls) {
            for (const wall of project.walls) {
                const isSelected = toolState.selectedObject && 
                                   toolState.selectedObject.type === 'wall' && 
                                   toolState.selectedObject.id === wall.id;
                this.drawWall(wall, isSelected);
            }
        }
        
        // Draw windows
        if (project.windows && project.walls) {
            for (const window of project.windows) {
                const wall = project.walls.find(w => w.id === window.wallId);
                if (wall) {
                    this.drawWindow(window, wall);
                }
            }
        }
        
        // Draw doors
        if (project.doors && project.walls) {
            for (const door of project.doors) {
                const wall = project.walls.find(w => w.id === door.wallId);
                if (wall) {
                    this.drawDoor(door, wall);
                }
            }
        }
        
        // Draw preview line if drawing wall
        if (toolState.isDrawing && toolState.previewEnd) {
            this.drawPreviewLine(toolState.previewStart, toolState.previewEnd);
        }
        
        // Draw snap point
        if (toolState.snapPoint) {
            this.drawSnapPoint(toolState.snapPoint);
        }
    }
}

// ==================== Main Application ====================
class InteriorPlanner {
    constructor() {
        this.projectManager = new ProjectManager();
        this.canvas = document.getElementById('planCanvas');
        this.renderer = new CanvasRenderer(this.canvas);
        
        this.currentTool = 'select';
        this.snapToGrid = true;
        
        this.toolState = {
            isDrawing: false,
            previewStart: null,
            previewEnd: null,
            snapPoint: null,
            selectedObject: null,
            isDragging: false,
            dragOffset: null
        };
        
        this.setupEventListeners();
        this.updateUI();
        this.render();
    }
    
    setupEventListeners() {
        // Tool buttons
        document.getElementById('selectTool').addEventListener('click', () => this.setTool('select'));
        document.getElementById('wallTool').addEventListener('click', () => this.setTool('wall'));
        document.getElementById('windowTool').addEventListener('click', () => this.setTool('window'));
        document.getElementById('doorTool').addEventListener('click', () => this.setTool('door'));
        
        // Snap to grid toggle
        document.getElementById('snapToGrid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
            this.render();
        });
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Project management
        document.getElementById('newProjectBtn').addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('duplicateProjectBtn').addEventListener('click', () => this.duplicateCurrentProject());
        document.getElementById('deleteProjectBtn').addEventListener('click', () => this.deleteCurrentProject());
        
        // Modal events
        document.getElementById('modalCancelBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('modalConfirmBtn').addEventListener('click', () => this.confirmModal());
        document.getElementById('modalInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmModal();
            if (e.key === 'Escape') this.hideModal();
        });
        
        // Room name input
        document.getElementById('roomNameField').addEventListener('blur', () => this.saveRoomName());
        document.getElementById('roomNameField').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveRoomName();
            if (e.key === 'Escape') {
                document.getElementById('roomNameInput').style.display = 'none';
            }
        });
    }
    
    setTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}Tool`).classList.add('active');
        
        // Update tool info
        const toolInfo = {
            select: 'Выберите объект или перетащите для перемещения',
            wall: 'Кликните для начала стены, кликните еще раз для завершения',
            window: 'Выберите стену для размещения окна',
            door: 'Выберите стену для размещения двери'
        };
        document.getElementById('toolInfo').textContent = toolInfo[tool] || '';
        
        // Reset tool state
        this.toolState.isDrawing = false;
        this.toolState.previewStart = null;
        this.toolState.previewEnd = null;
        
        this.render();
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        const worldPos = this.renderer.screenToWorld(mousePos);
        const snappedPos = this.snapToGrid ? this.snapToPoint(worldPos) : worldPos;
        
        const project = this.projectManager.getCurrentProject();
        if (!project) return;
        
        switch (this.currentTool) {
            case 'select':
                this.handleSelectMouseDown(snappedPos, mousePos);
                break;
            case 'wall':
                this.handleWallMouseDown(snappedPos);
                break;
            case 'window':
                this.handleWindowMouseDown(snappedPos, project);
                break;
            case 'door':
                this.handleDoorMouseDown(snappedPos, project);
                break;
        }
    }
    
    handleSelectMouseDown(worldPos, screenPos) {
        const project = this.projectManager.getCurrentProject();
        
        // Check for room click first
        for (const room of project.rooms || []) {
            if (room.containsPoint(worldPos)) {
                this.showRoomNameInput(room, screenPos);
                return;
            }
        }
        
        // Check for object selection
        let selected = null;
        
        // Check walls
        for (const wall of project.walls || []) {
            if (wall.containsPoint(worldPos)) {
                selected = { type: 'wall', ...wall };
                break;
            }
        }
        
        this.toolState.selectedObject = selected;
        if (selected) {
            this.toolState.isDragging = true;
            this.toolState.dragOffset = {
                x: worldPos.x - (selected.start ? selected.start.x : worldPos.x),
                y: worldPos.y - (selected.start ? selected.start.y : worldPos.y)
            };
        }
        
        this.updatePropertiesPanel();
        this.render();
    }
    
    handleWallMouseDown(snappedPos) {
        if (!this.toolState.isDrawing) {
            // Start drawing
            this.toolState.isDrawing = true;
            this.toolState.previewStart = snappedPos;
            this.toolState.previewEnd = snappedPos;
        } else {
            // End drawing
            const project = this.projectManager.getCurrentProject();
            const wall = new Wall(
                new Point(this.toolState.previewStart.x, this.toolState.previewStart.y),
                new Point(snappedPos.x, snappedPos.y)
            );
            project.walls.push(wall);
            this.projectManager.updateProject(project);
            
            // Recalculate rooms
            this.recalculateRooms(project);
            
            this.toolState.isDrawing = false;
            this.toolState.previewStart = null;
            this.toolState.previewEnd = null;
            this.render();
        }
    }
    
    handleWindowMouseDown(worldPos, project) {
        // Find closest wall
        let closestWall = null;
        let closestDist = Infinity;
        let closestParam = 0;
        
        for (const wall of project.walls || []) {
            const dist = wall.pointToLineDistance(worldPos);
            if (dist < closestDist && dist < SNAP_THRESHOLD * 2) {
                closestDist = dist;
                closestWall = wall;
                
                // Calculate position along wall
                const A = worldPos.x - wall.start.x;
                const B = worldPos.y - wall.start.y;
                const C = wall.end.x - wall.start.x;
                const D = wall.end.y - wall.start.y;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                closestParam = Math.max(0, Math.min(1, dot / lenSq));
            }
        }
        
        if (closestWall) {
            const window = new Window(closestWall.id, closestParam);
            project.windows.push(window);
            this.projectManager.updateProject(project);
            this.render();
        }
    }
    
    handleDoorMouseDown(worldPos, project) {
        // Find closest wall
        let closestWall = null;
        let closestDist = Infinity;
        let closestParam = 0;
        
        for (const wall of project.walls || []) {
            const dist = wall.pointToLineDistance(worldPos);
            if (dist < closestDist && dist < SNAP_THRESHOLD * 2) {
                closestDist = dist;
                closestWall = wall;
                
                const A = worldPos.x - wall.start.x;
                const B = worldPos.y - wall.start.y;
                const C = wall.end.x - wall.start.x;
                const D = wall.end.y - wall.start.y;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                closestParam = Math.max(0, Math.min(1, dot / lenSq));
            }
        }
        
        if (closestWall) {
            const door = new Door(closestWall.id, closestParam);
            project.doors.push(door);
            this.projectManager.updateProject(project);
            this.render();
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        const worldPos = this.renderer.screenToWorld(mousePos);
        const snappedPos = this.snapToGrid ? this.snapToPoint(worldPos) : worldPos;
        
        const project = this.projectManager.getCurrentProject();
        
        if (this.toolState.isDrawing) {
            this.toolState.previewEnd = snappedPos;
            
            // Find snap point
            this.toolState.snapPoint = this.findSnapPoint(snappedPos, project);
        } else if (this.toolState.isDragging && this.toolState.selectedObject) {
            if (this.toolState.selectedObject.type === 'wall') {
                const wall = project.walls.find(w => w.id === this.toolState.selectedObject.id);
                if (wall) {
                    const dx = worldPos.x - this.toolState.dragOffset.x - wall.start.x;
                    const dy = worldPos.y - this.toolState.dragOffset.y - wall.start.y;
                    wall.start.x += dx;
                    wall.start.y += dy;
                    wall.end.x += dx;
                    wall.end.y += dy;
                    this.projectManager.updateProject(project);
                    this.recalculateRooms(project);
                }
            }
        }
        
        this.render();
    }
    
    handleMouseUp(e) {
        this.toolState.isDragging = false;
        this.toolState.dragOffset = null;
    }
    
    handleDoubleClick(e) {
        const project = this.projectManager.getCurrentProject();
        if (!project) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        const worldPos = this.renderer.screenToWorld(mousePos);
        
        // Check for room double-click
        for (const room of project.rooms || []) {
            if (room.containsPoint(worldPos)) {
                this.showRoomNameInput(room, mousePos);
                return;
            }
        }
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Don't delete if typing in an input
            if (document.activeElement.tagName === 'INPUT') return;
            
            if (this.toolState.selectedObject) {
                const project = this.projectManager.getCurrentProject();
                
                if (this.toolState.selectedObject.type === 'wall') {
                    const wallId = this.toolState.selectedObject.id;
                    project.walls = project.walls.filter(w => w.id !== wallId);
                    project.windows = project.windows.filter(w => w.wallId !== wallId);
                    project.doors = project.doors.filter(d => d.wallId !== wallId);
                    
                    this.toolState.selectedObject = null;
                    this.projectManager.updateProject(project);
                    this.recalculateRooms(project);
                    this.updatePropertiesPanel();
                    this.render();
                }
            }
        }
    }
    
    snapToPoint(point) {
        const x = Math.round(point.x / GRID_SIZE) * GRID_SIZE;
        const y = Math.round(point.y / GRID_SIZE) * GRID_SIZE;
        return { x, y };
    }
    
    findSnapPoint(point, project) {
        if (!project) return null;
        
        let closestPoint = null;
        let closestDist = SNAP_THRESHOLD;
        
        // Check wall endpoints
        for (const wall of project.walls || []) {
            for (const endpoint of [wall.start, wall.end]) {
                const dist = Math.sqrt(
                    Math.pow(point.x - endpoint.x, 2) + 
                    Math.pow(point.y - endpoint.y, 2)
                );
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPoint = { x: endpoint.x, y: endpoint.y };
                }
            }
        }
        
        return closestPoint;
    }
    
    recalculateRooms(project) {
        const walls = project.walls.map(w => new Wall(
            new Point(w.start.x, w.start.y),
            new Point(w.end.x, w.end.y),
            w.id
        ));
        
        const detectedRooms = RoomDetector.findRooms(walls);
        
        // Preserve existing room names
        const oldRooms = project.rooms || [];
        for (const newRoom of detectedRooms) {
            for (const oldRoom of oldRooms) {
                if (this.roomsMatch(newRoom, oldRoom)) {
                    newRoom.name = oldRoom.name;
                    break;
                }
            }
        }
        
        project.rooms = detectedRooms;
        this.projectManager.updateProject(project);
    }
    
    roomsMatch(room1, room2) {
        // Simple centroid-based matching
        const dist = room1.centroid.distanceTo(room2.centroid);
        return dist < GRID_SIZE * 2;
    }
    
    showRoomNameInput(room, screenPos) {
        const input = document.getElementById('roomNameInput');
        const field = document.getElementById('roomNameField');
        
        field.value = room.name || '';
        field.dataset.roomId = room.id;
        
        input.style.display = 'block';
        input.style.left = `${screenPos.x - 75}px`;
        input.style.top = `${screenPos.y - 20}px`;
        
        field.focus();
        field.select();
    }
    
    saveRoomName() {
        const input = document.getElementById('roomNameInput');
        const field = document.getElementById('roomNameField');
        const roomId = field.dataset.roomId;
        const name = field.value.trim();
        
        const project = this.projectManager.getCurrentProject();
        if (project && roomId) {
            const room = project.rooms.find(r => r.id === roomId);
            if (room) {
                room.name = name;
                this.projectManager.updateProject(project);
            }
        }
        
        input.style.display = 'none';
        this.render();
    }
    
    updatePropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        const content = document.getElementById('propertiesContent');
        
        if (!this.toolState.selectedObject) {
            panel.style.display = 'none';
            return;
        }
        
        panel.style.display = 'block';
        
        if (this.toolState.selectedObject.type === 'wall') {
            const wall = this.toolState.selectedObject;
            const length = Math.round(wall.length / 10) / 10; // Convert to cm (assuming 1px = 1cm)
            
            content.innerHTML = `
                <div class="property-item">
                    <label>Тип</label>
                    <input type="text" value="Стена" disabled>
                </div>
                <div class="property-item">
                    <label>Длина (см)</label>
                    <input type="text" value="${length}" disabled>
                </div>
            `;
        }
    }
    
    // Project Management UI
    updateUI() {
        this.renderProjectsList();
        this.updateSelectedProjectInfo();
    }
    
    renderProjectsList() {
        const list = document.getElementById('projectsList');
        list.innerHTML = '';
        
        for (const project of this.projectManager.projects) {
            const li = document.createElement('li');
            li.textContent = project.name;
            if (project.id === this.projectManager.currentProjectId) {
                li.classList.add('active');
            }
            li.addEventListener('click', () => this.selectProject(project.id));
            li.addEventListener('dblclick', () => this.renameProject(project.id));
            list.appendChild(li);
        }
    }
    
    updateSelectedProjectInfo() {
        const info = document.getElementById('selectedProjectInfo');
        const nameEl = document.getElementById('currentProjectName');
        
        const project = this.projectManager.getCurrentProject();
        if (project) {
            info.style.display = 'block';
            nameEl.textContent = project.name;
        } else {
            info.style.display = 'none';
        }
    }
    
    selectProject(id) {
        this.projectManager.setCurrentProject(id);
        this.renderProjectsList();
        this.updateSelectedProjectInfo();
        this.render();
    }
    
    showNewProjectModal() {
        document.getElementById('modalTitle').textContent = 'Новый проект';
        document.getElementById('modalInput').value = '';
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('modalInput').focus();
    }
    
    hideModal() {
        document.getElementById('modalOverlay').style.display = 'none';
    }
    
    confirmModal() {
        const name = document.getElementById('modalInput').value.trim();
        if (name) {
            const project = this.projectManager.createProject(name);
            this.projectManager.setCurrentProject(project.id);
            this.updateUI();
            this.render();
        }
        this.hideModal();
    }
    
    renameProject(id) {
        const project = this.projectManager.getProject(id);
        if (!project) return;
        
        const newName = prompt('Введите новое название проекта:', project.name);
        if (newName && newName.trim()) {
            this.projectManager.renameProject(id, newName.trim());
            this.updateUI();
        }
    }
    
    duplicateCurrentProject() {
        const project = this.projectManager.getCurrentProject();
        if (!project) return;
        
        const duplicate = this.projectManager.duplicateProject(project.id);
        if (duplicate) {
            this.projectManager.setCurrentProject(duplicate.id);
            this.updateUI();
            this.render();
        }
    }
    
    deleteCurrentProject() {
        const project = this.projectManager.getCurrentProject();
        if (!project) return;
        
        if (confirm(`Вы уверены, что хотите удалить проект "${project.name}"?`)) {
            this.projectManager.deleteProject(project.id);
            this.updateUI();
            this.render();
        }
    }
    
    render() {
        const project = this.projectManager.getCurrentProject();
        
        if (!project) {
            this.renderer.clear();
            this.renderer.drawGrid(this.snapToGrid);
            return;
        }
        
        this.renderer.render(project, this.toolState);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InteriorPlanner();
});

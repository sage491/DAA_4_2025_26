#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdlib>
#include <cctype>
#include <iostream>
#include <limits>
#include <queue>
#include <stdexcept>
#include <string>
#include <vector>

struct Point {
    int row = -1;
    int col = -1;
};

struct Step {
    std::string type;
    int x = 0;
    int y = 0;
};

struct RunConfig {
    std::vector<std::vector<int>> grid;
    Point start;
    Point end;
    std::string algorithm = "astar";
    std::string heuristic = "manhattan";
    bool allowDiagonal = false;
};

struct ParseError : std::runtime_error {
    using std::runtime_error::runtime_error;
};

static std::string readAllInput() {
    return std::string(std::istreambuf_iterator<char>(std::cin), std::istreambuf_iterator<char>());
}

static void skipWhitespace(const std::string& text, std::size_t& index) {
    while (index < text.size() && std::isspace(static_cast<unsigned char>(text[index]))) {
        ++index;
    }
}

static std::size_t findValueStart(const std::string& json, const std::string& key) {
    const std::string needle = '"' + key + '"';
    std::size_t keyPos = json.find(needle);
    if (keyPos == std::string::npos) {
        return std::string::npos;
    }

    std::size_t colon = json.find(':', keyPos + needle.size());
    if (colon == std::string::npos) {
        return std::string::npos;
    }

    std::size_t index = colon + 1;
    skipWhitespace(json, index);
    return index;
}

static std::string extractQuotedString(const std::string& json, std::size_t& index) {
    if (index >= json.size() || json[index] != '"') {
        throw ParseError("Expected JSON string.");
    }

    ++index;
    std::string result;
    while (index < json.size()) {
        char ch = json[index++];
        if (ch == '\\') {
            if (index >= json.size()) {
                throw ParseError("Invalid JSON string escape.");
            }
            char escaped = json[index++];
            switch (escaped) {
                case '"': result.push_back('"'); break;
                case '\\': result.push_back('\\'); break;
                case '/': result.push_back('/'); break;
                case 'b': result.push_back('\b'); break;
                case 'f': result.push_back('\f'); break;
                case 'n': result.push_back('\n'); break;
                case 'r': result.push_back('\r'); break;
                case 't': result.push_back('\t'); break;
                default: throw ParseError("Unsupported JSON escape sequence.");
            }
            continue;
        }

        if (ch == '"') {
            return result;
        }

        result.push_back(ch);
    }

    throw ParseError("Unterminated JSON string.");
}

static std::string extractBracketed(const std::string& json, std::size_t index, char openChar, char closeChar) {
    if (index >= json.size() || json[index] != openChar) {
        throw ParseError("Expected bracketed JSON value.");
    }

    int depth = 0;
    for (std::size_t cursor = index; cursor < json.size(); ++cursor) {
        char ch = json[cursor];
        if (ch == openChar) {
            ++depth;
        } else if (ch == closeChar) {
            --depth;
            if (depth == 0) {
                return json.substr(index, cursor - index + 1);
            }
        }
    }

    throw ParseError("Unterminated JSON container.");
}

static bool extractBool(const std::string& json, const std::string& key, bool fallback) {
    std::size_t index = findValueStart(json, key);
    if (index == std::string::npos) {
        return fallback;
    }

    if (json.compare(index, 4, "true") == 0) {
        return true;
    }
    if (json.compare(index, 5, "false") == 0) {
        return false;
    }

    throw ParseError("Expected boolean value.");
}

static std::string extractStringField(const std::string& json, const std::string& key, const std::string& fallback) {
    std::size_t index = findValueStart(json, key);
    if (index == std::string::npos) {
        return fallback;
    }

    return extractQuotedString(json, index);
}

static int parseIntegerToken(const std::string& token) {
    std::size_t index = 0;
    int value = std::stoi(token, &index);
    if (index != token.size()) {
        throw ParseError("Invalid integer value.");
    }
    return value;
}

static std::vector<int> parseIntArray(const std::string& json) {
    if (json.size() < 2 || json.front() != '[' || json.back() != ']') {
        throw ParseError("Expected integer array.");
    }

    std::vector<int> values;
    std::size_t index = 1;
    while (index < json.size() - 1) {
        skipWhitespace(json, index);
        if (index >= json.size() - 1) {
            break;
        }

        std::size_t start = index;
        if (json[index] == '-' || json[index] == '+') {
            ++index;
        }
        while (index < json.size() - 1 && std::isdigit(static_cast<unsigned char>(json[index]))) {
            ++index;
        }
        if (start == index) {
            throw ParseError("Expected integer in array.");
        }

        values.push_back(parseIntegerToken(json.substr(start, index - start)));
        skipWhitespace(json, index);
        if (index < json.size() - 1 && json[index] == ',') {
            ++index;
        }
    }

    return values;
}

static std::vector<std::vector<int>> parseGrid(const std::string& json) {
    if (json.size() < 2 || json.front() != '[' || json.back() != ']') {
        throw ParseError("Expected grid array.");
    }

    std::vector<std::vector<int>> grid;
    std::size_t index = 1;
    while (index < json.size() - 1) {
        skipWhitespace(json, index);
        if (index >= json.size() - 1) {
            break;
        }

        std::string rowText = extractBracketed(json, index, '[', ']');
        grid.push_back(parseIntArray(rowText));
        index += rowText.size();
        skipWhitespace(json, index);
        if (index < json.size() - 1 && json[index] == ',') {
            ++index;
        }
    }

    return grid;
}

static Point parsePointField(const std::string& json, const std::string& key) {
    std::size_t index = findValueStart(json, key);
    if (index == std::string::npos) {
        throw ParseError("Missing point field.");
    }

    std::string value = extractBracketed(json, index, '[', ']');
    std::vector<int> pair = parseIntArray(value);
    if (pair.size() != 2) {
        throw ParseError("Point fields must contain exactly two integers.");
    }

    return {pair[0], pair[1]};
}

static RunConfig parseConfig(const std::string& json) {
    RunConfig config;

    std::size_t gridIndex = findValueStart(json, "grid");
    if (gridIndex == std::string::npos) {
        throw ParseError("Missing grid field.");
    }
    config.grid = parseGrid(extractBracketed(json, gridIndex, '[', ']'));
    if (config.grid.empty() || config.grid[0].empty()) {
        throw ParseError("Grid cannot be empty.");
    }

    for (const auto& row : config.grid) {
        if (row.size() != config.grid[0].size()) {
            throw ParseError("Grid must be rectangular.");
        }
    }

    config.start = parsePointField(json, "start");
    config.end = parsePointField(json, "end");
    config.algorithm = extractStringField(json, "algorithm", "astar");
    config.heuristic = extractStringField(json, "heuristic", "manhattan");
    config.allowDiagonal = extractBool(json, "allowDiagonal", false);

    std::string algorithmLower = config.algorithm;
    std::transform(algorithmLower.begin(), algorithmLower.end(), algorithmLower.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    config.algorithm = algorithmLower;

    std::string heuristicLower = config.heuristic;
    std::transform(heuristicLower.begin(), heuristicLower.end(), heuristicLower.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    config.heuristic = heuristicLower;

    return config;
}

static bool inBounds(const RunConfig& config, int row, int col) {
    return row >= 0 && col >= 0 && row < static_cast<int>(config.grid.size()) && col < static_cast<int>(config.grid[0].size());
}

static bool passable(const RunConfig& config, int row, int col) {
    return inBounds(config, row, col) && config.grid[row][col] != -1;
}

static double heuristicCost(const RunConfig& config, Point a, Point b) {
    const double dr = static_cast<double>(std::abs(a.row - b.row));
    const double dc = static_cast<double>(std::abs(a.col - b.col));
    if (config.heuristic == "euclidean") {
        return std::sqrt(dr * dr + dc * dc);
    }

    return dr + dc;
}

static std::vector<Point> neighbors(const RunConfig& config, Point current) {
    static const int orthogonal[4][2] = {{-1, 0}, {0, 1}, {1, 0}, {0, -1}};
    static const int diagonal[4][2] = {{-1, -1}, {-1, 1}, {1, 1}, {1, -1}};

    std::vector<Point> result;
    for (const auto& offset : orthogonal) {
        int row = current.row + offset[0];
        int col = current.col + offset[1];
        if (passable(config, row, col)) {
            result.push_back({row, col});
        }
    }

    if (config.allowDiagonal) {
        for (const auto& offset : diagonal) {
            int row = current.row + offset[0];
            int col = current.col + offset[1];
            if (passable(config, row, col)) {
                result.push_back({row, col});
            }
        }
    }

    return result;
}

static std::vector<Point> reconstructPath(const std::vector<std::vector<Point>>& parent, Point start, Point goal) {
    std::vector<Point> path;
    if (!(start.row == goal.row && start.col == goal.col) && parent[goal.row][goal.col].row == -1) {
        return path;
    }

    Point current = goal;
    path.push_back(current);
    while (!(current.row == start.row && current.col == start.col)) {
        current = parent[current.row][current.col];
        path.push_back(current);
    }

    std::reverse(path.begin(), path.end());
    return path;
}

static std::vector<Step> runBfs(const RunConfig& config) {
    std::vector<Step> steps;
    std::queue<Point> queue;
    std::vector<std::vector<bool>> seen(config.grid.size(), std::vector<bool>(config.grid[0].size(), false));
    std::vector<std::vector<Point>> parent(config.grid.size(), std::vector<Point>(config.grid[0].size(), {-1, -1}));

    queue.push(config.start);
    seen[config.start.row][config.start.col] = true;
    parent[config.start.row][config.start.col] = config.start;

    while (!queue.empty()) {
        Point current = queue.front();
        queue.pop();
        steps.push_back({"visit", current.row, current.col});

        if (current.row == config.end.row && current.col == config.end.col) {
            break;
        }

        for (const auto& next : neighbors(config, current)) {
            if (!seen[next.row][next.col]) {
                seen[next.row][next.col] = true;
                parent[next.row][next.col] = current;
                queue.push(next);
            }
        }
    }

    std::vector<Point> path = reconstructPath(parent, config.start, config.end);
    for (const auto& point : path) {
        steps.push_back({"path", point.row, point.col});
    }
    return steps;
}

static std::vector<Step> runDfs(const RunConfig& config) {
    std::vector<Step> steps;
    std::vector<Point> stack;
    std::vector<std::vector<bool>> seen(config.grid.size(), std::vector<bool>(config.grid[0].size(), false));
    std::vector<std::vector<Point>> parent(config.grid.size(), std::vector<Point>(config.grid[0].size(), {-1, -1}));

    stack.push_back(config.start);
    parent[config.start.row][config.start.col] = config.start;

    while (!stack.empty()) {
        Point current = stack.back();
        stack.pop_back();

        if (seen[current.row][current.col]) {
            continue;
        }

        seen[current.row][current.col] = true;
        steps.push_back({"visit", current.row, current.col});

        if (current.row == config.end.row && current.col == config.end.col) {
            break;
        }

        std::vector<Point> nextPoints = neighbors(config, current);
        std::reverse(nextPoints.begin(), nextPoints.end());
        for (const auto& next : nextPoints) {
            if (!seen[next.row][next.col] && parent[next.row][next.col].row == -1) {
                parent[next.row][next.col] = current;
            }
            stack.push_back(next);
        }
    }

    std::vector<Point> path = reconstructPath(parent, config.start, config.end);
    for (const auto& point : path) {
        steps.push_back({"path", point.row, point.col});
    }
    return steps;
}

static std::vector<Step> runDijkstra(const RunConfig& config, bool useAStar) {
    struct Node {
        double score = 0.0;
        double cost = 0.0;
        Point point;

        bool operator>(const Node& other) const {
            if (score == other.score) {
                return cost > other.cost;
            }
            return score > other.score;
        }
    };

    std::vector<Step> steps;
    std::priority_queue<Node, std::vector<Node>, std::greater<Node>> queue;
    std::vector<std::vector<double>> dist(config.grid.size(), std::vector<double>(config.grid[0].size(), std::numeric_limits<double>::infinity()));
    std::vector<std::vector<bool>> closed(config.grid.size(), std::vector<bool>(config.grid[0].size(), false));
    std::vector<std::vector<Point>> parent(config.grid.size(), std::vector<Point>(config.grid[0].size(), {-1, -1}));

    queue.push({0.0, 0.0, config.start});
    dist[config.start.row][config.start.col] = 0.0;
    parent[config.start.row][config.start.col] = config.start;

    while (!queue.empty()) {
        Node current = queue.top();
        queue.pop();

        if (closed[current.point.row][current.point.col]) {
            continue;
        }

        closed[current.point.row][current.point.col] = true;
        steps.push_back({"visit", current.point.row, current.point.col});

        if (current.point.row == config.end.row && current.point.col == config.end.col) {
            break;
        }

        for (const auto& next : neighbors(config, current.point)) {
            double stepCost = config.grid[next.row][next.col] > 1 ? static_cast<double>(config.grid[next.row][next.col]) : 1.0;
            bool diagonalMove = std::abs(next.row - current.point.row) == 1 && std::abs(next.col - current.point.col) == 1;
            if (diagonalMove) {
                stepCost *= 1.41421356237;
            }

            double nextCost = current.cost + stepCost;
            if (nextCost < dist[next.row][next.col]) {
                dist[next.row][next.col] = nextCost;
                parent[next.row][next.col] = current.point;
                double priority = useAStar ? nextCost + heuristicCost(config, next, config.end) : nextCost;
                queue.push({priority, nextCost, next});
            }
        }
    }

    std::vector<Point> path = reconstructPath(parent, config.start, config.end);
    for (const auto& point : path) {
        steps.push_back({"path", point.row, point.col});
    }
    return steps;
}

static std::vector<Step> runSearch(const RunConfig& config) {
    if (!passable(config, config.start.row, config.start.col) || !passable(config, config.end.row, config.end.col)) {
        return {};
    }

    if (config.algorithm == "bfs") {
        return runBfs(config);
    }
    if (config.algorithm == "dfs") {
        return runDfs(config);
    }
    if (config.algorithm == "dijkstra") {
        return runDijkstra(config, false);
    }

    return runDijkstra(config, true);
}

static void writeJson(const std::vector<Step>& steps) {
    std::cout << '[';
    for (std::size_t index = 0; index < steps.size(); ++index) {
        const Step& step = steps[index];
        std::cout << '{'
                  << "\"type\":\"" << step.type << "\"," 
                  << "\"x\":" << step.x << ','
                  << "\"y\":" << step.y
                  << '}';
        if (index + 1 < steps.size()) {
            std::cout << ',';
        }
    }
    std::cout << ']';
}

int main() {
    try {
        const std::string input = readAllInput();
        if (input.empty()) {
            std::cout << "[]";
            return 0;
        }

        const RunConfig config = parseConfig(input);
        const std::vector<Step> steps = runSearch(config);
        writeJson(steps);
    } catch (...) {
        std::cout << "[]";
    }

    return 0;
}
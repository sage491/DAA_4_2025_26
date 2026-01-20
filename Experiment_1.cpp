#include <iostream>
#include <algorithm>
#include <ctime>
using namespace std;

long long ops = 0;
int maxDepth = 0;

void complexRec(int n, int depth) {
    maxDepth = max(maxDepth, depth);

    if (n <= 2) return;

    int p = n;
    while (p > 0) {
        for (int i = 0; i < n; i++) {
            ops++;
        }
        p >>= 1;
    }
    for (int i = 0; i < n; i++) {
        ops++;
    }

    ops += n;

    complexRec(n/2, depth + 1);
    complexRec(n/2, depth + 1);
    complexRec(n/2, depth + 1);
}

int main() {
    int n;
    cin >> n;

    clock_t start = clock();
    complexRec(n, 1);
    clock_t end = clock();

    double time_ms = 1000.0 * (end - start) / CLOCKS_PER_SEC;

    cout << "Operations = " << ops << endl;
    cout << "Recursion Depth = " << maxDepth << endl;
    cout << "Time (ms) = " << time_ms << endl;
}

// To compile and run:
// g++ -std=c++14 Experiment_1.cpp -o Experiment_1
// ./Experiment_1

/*
while (p > 0) {          // p = n, n/2, n/4, ... 1  → (log n) iterations
    vector<int> temp(n);

    for (int i = 0; i < n; i++) {   // Θ(n)
        temp[i] = i ^ p;
    }

    p >>= 1;
}

vector<int> small(n);

for (int i = 0; i < n; i++) {       // Θ(n)
    small[i] = i * i;
}

reverse(small.begin(), small.end());   // Θ(n)

complexRec(n/2);
complexRec(n/2);
complexRec(n/2);
*/
/*Time Complexity Analysis:
Let T(n) be the time complexity of complexRec for input size n.
Total non-recursive work = Θ(n log n)
Recursive calls: 3 calls on size n/2.

Thus, the recurrence relation is:
T(n) = 3T(n/2) + Θ(n log n)
base case: T(n) = Θ(1) for n <= 2
Using the Master Theorem:
a = 3, b = 2, f(n) = Θ(n log n)
log_b(a) = log_2(3) ≈ 1.585
Since f(n) grows faster than n^(log_b(a)), we apply case 3 of the Master Theorem:
T(n) = Θ(f(n)) = Θ(n log n)*/

function wait(ms: number) {
    const start = performance.now();
    while (performance.now() - start < ms);
}

/** @jsbm statement-100μs */
wait(0.1);

/**
 * @jsbm block-200μs
 */
{
    wait(0.1);

    /** @jsbm nest-100μs */
    wait(0.1);
}

/**
 * @jsbm declaration(0.2) declaration-200μs
 */
function declaration(ms: number) {
    wait(ms);

    /**
     * @jsbm nest-200μs
     */
    function nest() {
        wait(ms);
    }
}

/**
 * @jsbm funct(0.1) assign-function-100μs
 */
const funct = function (ms: number) {
    wait(ms);
};

/**
 * @jsbm arrow(0.1) assign-arrow-100μs
 * @jsbm arrow(0.2) assign-arrow-200μs
 */
const arrow = (ms: number) => {
    wait(ms);
};
